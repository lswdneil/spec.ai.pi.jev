/**
 * Stages the agent-desktop CLI under resources/bundled-agent-desktop/<platform>-<arch>/.
 *
 * agent-desktop (Apache-2.0, vercel-labs/agent-desktop) is a standalone executable: the agent calls it through
 * its own shell, so the installer has to carry a build for the machine it lands on. The pinned release archive is
 * downloaded and its SHA-256 checked against the release's checksums.txt. MU_AGENT_DESKTOP_BINARY names a local
 * executable for offline builds; MU_SKIP_AGENT_DESKTOP=1 builds without it.
 *
 * Usage: node scripts/prepareAgentDesktopResources.js [--platform <win32|darwin|linux>] [--arch <x64|arm64>] [--force]
 */
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { existsSync, promises: fs, readFileSync, writeFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const VERSION = '1.2.0';
const REPOSITORY = 'vercel-labs/agent-desktop';
const TARGETS = {
  'win32-x64': 'x86_64-pc-windows-msvc',
  'win32-arm64': 'aarch64-pc-windows-msvc',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
};

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function normalizeArch(value) {
  if (value === 'x86_64' || value === 'amd64') return 'x64';
  if (value === 'aarch64') return 'arm64';
  return value;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function download(url, destination) {
  const temporary = `${destination}.tmp`;
  // curl follows the release redirect and honours HTTPS_PROXY, which is how restricted build machines reach GitHub.
  try {
    execFileSync('curl', ['-fsSL', '--retry', '3', '--retry-delay', '2', '-o', temporary, url], {
      stdio: 'inherit',
      timeout: 300000,
    });
    // Windows refuses to rename over an existing file, so a forced rebuild removes the old copy first.
    await fs.rm(destination, { force: true });
    await fs.rename(temporary, destination);
  } catch (error) {
    fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

function archiveName(platformKey) {
  return `agent-desktop-v${VERSION}-${TARGETS[platformKey]}.tar.gz`;
}

function tarCommand() {
  if (process.platform !== 'win32') return 'tar';
  const systemRoot = process.env.SystemRoot || process.env.windir;
  const inBox = systemRoot ? path.join(systemRoot, 'System32', 'tar.exe') : '';
  return inBox && existsSync(inBox) ? inBox : 'tar';
}

function expectedChecksum(contents, fileName) {
  for (const line of contents.split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (match && match[2] === fileName) return match[1].toLowerCase();
  }
  throw new Error(`checksums.txt has no entry for ${fileName}`);
}

async function stageFromRelease(destination, platformKey, force) {
  const archive = path.join(os.tmpdir(), `specjev-${archiveName(platformKey)}`);
  const checksums = path.join(os.tmpdir(), `specjev-agent-desktop-checksums-${VERSION}.txt`);
  if (force || !existsSync(archive)) {
    const base = `https://github.com/${REPOSITORY}/releases/download/v${VERSION}`;
    console.log(`Downloading agent-desktop ${VERSION} for ${platformKey}...`);
    await download(`${base}/${archiveName(platformKey)}`, archive);
    await download(`${base}/checksums.txt`, checksums);
  }
  if (!existsSync(checksums)) {
    const base = `https://github.com/${REPOSITORY}/releases/download/v${VERSION}`;
    await download(`${base}/checksums.txt`, checksums);
  }

  const expected = expectedChecksum(readFileSync(checksums, 'utf8'), archiveName(platformKey));
  const actual = sha256(archive);
  if (actual !== expected) throw new Error(`agent-desktop checksum mismatch: ${actual} != ${expected}`);

  await fs.mkdir(destination, { recursive: true });
  execFileSync(tarCommand(), ['-xzf', archive, '-C', destination], { stdio: 'inherit', timeout: 120000 });
}

async function stageFromBinary(source, destination, platform) {
  const stat = await fs.stat(source);
  if (!stat.isFile()) throw new Error(`MU_AGENT_DESKTOP_BINARY is not a file: ${source}`);
  await fs.mkdir(destination, { recursive: true });
  const name = platform === 'win32' ? 'agent-desktop.exe' : 'agent-desktop';
  await fs.copyFile(source, path.join(destination, name));
  if (platform !== 'win32') await fs.chmod(path.join(destination, name), 0o755);

  if (platform === 'darwin') {
    const helper = process.env.MU_AGENT_DESKTOP_HELPER;
    if (!helper || !existsSync(helper)) {
      throw new Error(
        'A macOS build also needs its helper: set MU_AGENT_DESKTOP_HELPER to agent-desktop-macos-helper.'
      );
    }
    await fs.copyFile(helper, path.join(destination, 'agent-desktop-macos-helper'));
  }
}

async function main() {
  const platform = argument('platform', process.platform);
  const arch = normalizeArch(argument('arch', process.arch));
  const platformKey = `${platform}-${arch}`;
  if (!TARGETS[platformKey]) throw new Error(`agent-desktop has no release for ${platformKey}`);

  const root = path.resolve(__dirname, '..');
  const destination = path.join(root, 'resources', 'bundled-agent-desktop', platformKey);
  if (process.env.MU_SKIP_AGENT_DESKTOP === '1') {
    // Keep the folder electron-builder's extraResources names, so a skipped local build still packages.
    await fs.mkdir(destination, { recursive: true });
    console.warn('MU_SKIP_AGENT_DESKTOP=1: the installer will not carry agent-desktop.');
    return;
  }

  const marker = path.join(destination, '.version');
  const binary = path.join(destination, platform === 'win32' ? 'agent-desktop.exe' : 'agent-desktop');
  const wanted = `${VERSION} ${platformKey}`;
  const force = process.argv.includes('--force');

  if (!force && existsSync(binary) && existsSync(marker) && readFileSync(marker, 'utf8').trim() === wanted) {
    console.log(`agent-desktop ${VERSION} already staged at ${destination}`);
    return;
  }

  const supplied = process.env.MU_AGENT_DESKTOP_BINARY;
  if (supplied) {
    await stageFromBinary(path.resolve(supplied), destination, platform);
  } else {
    await stageFromRelease(destination, platformKey, force);
  }

  if (!existsSync(binary)) {
    throw new Error(`agent-desktop was not extracted: ${binary}`);
  }
  if (platform !== 'win32') await fs.chmod(binary, 0o755);
  writeFileSync(marker, `${wanted}\n`, 'utf8');
  console.log(`Bundled agent-desktop ${VERSION} at ${destination}`);
}

main().catch((error) => {
  console.error(`prepareAgentDesktopResources failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
