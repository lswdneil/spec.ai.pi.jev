'use strict';

// spec.jev packaging patch: upstream html2pptx.js launches the Chromium that
// Playwright downloads. The packaged app carries no browser and must not fetch
// one at run time, so this looks for a Chromium-based browser already installed
// on the machine (Edge, Chrome), then for a Playwright download, and only then
// gives up with the reasons it tried.
//
// Override with SPECJEV_CHROMIUM=<path to a Chromium-based executable>.

const { chromium } = require('playwright-core');

const CHANNELS = [{ channel: 'msedge' }, { channel: 'chrome' }];

function installedBrowsers() {
  const found = [];
  if (process.env.SPECJEV_CHROMIUM) found.push(process.env.SPECJEV_CHROMIUM);
  try {
    const downloaded = chromium.executablePath();
    if (downloaded) found.push(downloaded);
  } catch {
    // No Playwright download: the channels above are expected to work.
  }
  return found;
}

function reason(error) {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}

async function launch(options = {}) {
  if (options.channel || options.executablePath) return chromium.launch(options);

  const attempts = [];
  for (const candidate of CHANNELS) {
    try {
      return await chromium.launch({ ...options, ...candidate });
    } catch (error) {
      attempts.push(`${candidate.channel}: ${reason(error)}`);
    }
  }
  for (const executablePath of installedBrowsers()) {
    try {
      return await chromium.launch({ ...options, executablePath });
    } catch (error) {
      attempts.push(`${executablePath}: ${reason(error)}`);
    }
  }

  throw new Error(
    [
      'No Chromium-based browser could be started.',
      'Install Microsoft Edge or Google Chrome, run `npx playwright install chromium`,',
      'or point SPECJEV_CHROMIUM at a browser executable.',
      ...attempts.map((attempt) => `  - ${attempt}`),
    ].join('\n')
  );
}

module.exports = { chromium: Object.assign({}, chromium, { launch }) };
