#!/usr/bin/env node
// Prints an HTML page to PDF with a Chromium-based browser that is already on the machine.
//
//   node html-to-pdf.mjs page.html --out page.pdf
//   node html-to-pdf.mjs http://localhost:3000/report --out report.pdf --timeout 120000
//
// The page decides its own paper: `@page { size: A4; margin: 18mm }` is honoured. Without it the
// browser's default paper and margins apply. Headers and footers are off.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const options = { timeout: 60000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === '--out') options.out = next();
    else if (arg === '--timeout') options.timeout = Number(next());
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (options.input) throw new Error(`unexpected argument ${arg}`);
    else options.input = arg;
  }
  if (!options.input) throw new Error('usage: node html-to-pdf.mjs <page.html|url> --out <file.pdf>');
  if (!options.out) options.out = options.input.replace(/\.[^.\\/]+$/, '') + '.pdf';
  return options;
}

/** A Chromium-based browser already installed, in the order worth trying. */
function browsers() {
  const found = [];
  if (process.env.SPECJEV_CHROMIUM) found.push(process.env.SPECJEV_CHROMIUM);
  if (process.platform === 'win32') {
    found.push(
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );
  } else if (process.platform === 'darwin') {
    found.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else {
    found.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge');
  }
  for (const path of playwrightBrowsers()) found.push(path);
  return found.filter((path) => existsSync(path));
}

/** Chromium that `npx playwright install chromium` left in its cache, newest first. */
function playwrightBrowsers() {
  const root =
    process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
      : process.platform === 'darwin'
        ? join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright')
        : join(process.env.HOME ?? '', '.cache', 'ms-playwright');
  let entries;
  try {
    entries = readdirSync(root).filter((name) => name.startsWith('chromium-'));
  } catch {
    return [];
  }
  const inside =
    process.platform === 'win32'
      ? ['chrome-win', 'chrome.exe']
      : process.platform === 'darwin'
        ? ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium']
        : ['chrome-linux', 'chrome'];
  return entries.sort().reverse().map((name) => join(root, name, ...inside));
}

function print(browser, target, out, profile, timeout) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=3000',
    `--user-data-dir=${profile}`,
    `--print-to-pdf=${out}`,
    target,
  ];
  return new Promise((resolvePromise, reject) => {
    const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${browser} did not finish in ${timeout} ms`));
    }, timeout);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(`${browser} exited with ${code}: ${stderr.split('\n').slice(-3).join(' ')}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const out = resolve(options.out);
  const target = /^https?:\/\//.test(options.input) ? options.input : pathToFileURL(resolve(options.input)).href;
  if (!/^https?:\/\//.test(options.input) && !existsSync(resolve(options.input)))
    throw new Error(`${options.input} does not exist`);

  const candidates = browsers();
  if (candidates.length === 0)
    throw new Error(
      'No Chromium-based browser found. Install Microsoft Edge or Google Chrome, run `npx playwright install chromium`, or set SPECJEV_CHROMIUM.'
    );

  const reasons = [];
  for (const browser of candidates) {
    const profile = mkdtempSync(join(tmpdir(), 'specjev-pdf-'));
    try {
      await print(browser, target, out, profile, options.timeout);
      if (existsSync(out) && statSync(out).size > 0) {
        console.log(`✓ ${out}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
        return;
      }
      reasons.push(`${browser}: exited without writing the file`);
    } catch (error) {
      reasons.push(`${browser}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      rmSync(profile, { recursive: true, force: true });
    }
  }
  throw new Error(['No browser could print the page.', ...reasons.map((reason) => `  - ${reason}`)].join('\n'));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
