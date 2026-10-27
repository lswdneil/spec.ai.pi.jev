/**
 * Stages the moli browser under resources/bundled-moli/<platform>-<arch>/.
 *
 * A local checkout can pass MU_MOLI_BINARY (for example target/release/moli.exe from a source build).
 * Otherwise this downloads the pinned official release asset and verifies its SHA-256. The installer
 * carries the binary, so the agent can use moli without a separate install.
 */
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createWriteStream, promises: fs } = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const VERSION = '1.1.19';
const RELEASE = `https://github.com/lexmount/moli/releases/download/v${VERSION}`;
const ASSETS = {
  'win32-x64': {
    name: 'moli-x86_64-pc-windows-msvc.zip',
    sha256: '708b93531d9d9f20c7fad31217b1c8d8c6969c546ea3668c0a568f0ce7778525',
  },
  'win32-arm64': {
    name: 'moli-aarch64-pc-windows-msvc.zip',
    sha256: '2ab75a3f24b0db588f7e8ebc523dbcd26230feaf8bac3ece8216d97a6af73ae6',
  },
  'linux-x64': {
    name: 'moli-x86_64-unknown-linux-gnu.tar.gz',
    sha256: '5c22362065e64e6de785274f6b3f28a735fca363abf9896c48733e5f58489def',
  },
  'linux-arm64': {
    name: 'moli-aarch64-unknown-linux-gnu.tar.gz',
    sha256: 'f3c71ff43d250fdc16fbf74a34f7c0041b47f8ba25bba1cb476bc88db587bfc8',
  },
};

function option(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function binaryName(platform) {
  return platform === 'win32' ? 'moli.exe' : 'moli';
}

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error(`Too many redirects for ${url}`));
      return;
    }
    https
      .get(url, { headers: { 'user-agent': 'spec.jev-build' } }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          download(response.headers.location, destination, redirects + 1).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }
        const file = createWriteStream(destination);
        response.pipe(file);
        file.once('finish', () => file.close(resolve));
        file.once('error', reject);
      })
      .on('error', reject);
  });
}

async function digest(file, algorithm, encoding) {
  const hash = createHash(algorithm);
  const stream = require('node:fs').createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest(encoding);
}

function extractZip(archive, directory) {
  return new Promise((resolve, reject) => {
    const yauzl = require('yauzl');
    yauzl.open(archive, { lazyEntries: true }, (openError, zip) => {
      if (openError) {
        reject(openError);
        return;
      }
      zip.once('error', reject);
      zip.once('end', resolve);
      zip.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        const target = path.join(directory, ...entry.fileName.split('/').filter(Boolean));
        if (!target.startsWith(`${directory}${path.sep}`)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            reject(streamError);
            return;
          }
          require('node:fs').mkdirSync(path.dirname(target), { recursive: true });
          const file = require('node:fs').createWriteStream(target);
          stream.pipe(file);
          file.once('finish', () => file.close(() => zip.readEntry()));
          file.once('error', reject);
        });
      });
      zip.readEntry();
    });
  });
}

async function extract(archive, directory, platform) {
  if (archive.endsWith('.zip')) {
    await extractZip(archive, directory);
    return;
  }
  if (platform === 'linux' || archive.endsWith('.tar.gz')) {
    execFileSync('tar', ['-xzf', archive, '-C', directory], { stdio: 'inherit' });
    return;
  }
  throw new Error(`Unsupported moli archive: ${archive}`);
}

async function findBinary(directory, name) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === name) return file;
    if (entry.isDirectory()) {
      const nested = await findBinary(file, name);
      if (nested) return nested;
    }
  }
  return undefined;
}

async function main() {
  const platform = option('platform') || process.platform;
  const arch = option('arch') || process.arch;
  const destination = path.resolve(
    __dirname,
    '..',
    'resources',
    'bundled-moli',
    `${platform}-${arch}`,
    binaryName(platform)
  );
  await fs.mkdir(path.dirname(destination), { recursive: true });

  const supplied = process.env.MU_MOLI_BINARY;
  if (supplied) {
    const source = path.resolve(supplied);
    if (!(await fs.stat(source)).isFile()) throw new Error(`MU_MOLI_BINARY is not a file: ${source}`);
    await fs.copyFile(source, destination);
    if (platform !== 'win32') await fs.chmod(destination, 0o755);
    console.log(`Bundled moli from ${source} at ${destination}`);
    return;
  }

  const asset = ASSETS[`${platform}-${arch}`];
  if (!asset) {
    console.warn(`No bundled moli release for ${platform}-${arch}; leaving the app without one.`);
    return;
  }

  const scratch = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'specjev-moli-'));
  const archive = path.join(scratch, asset.name);
  try {
    console.log(`Downloading moli ${VERSION} for ${platform}-${arch}`);
    await download(`${RELEASE}/${asset.name}`, archive);
    const actual = await digest(archive, 'sha256', 'hex');
    if (actual !== asset.sha256) throw new Error(`moli checksum mismatch: ${actual}`);
    const unpacked = path.join(scratch, 'unpacked');
    await fs.mkdir(unpacked);
    await extract(archive, unpacked, platform);
    const binary = await findBinary(unpacked, binaryName(platform));
    if (!binary) throw new Error(`The moli release ${asset.name} has no ${binaryName(platform)}`);
    await fs.copyFile(binary, destination);
    if (platform !== 'win32') await fs.chmod(destination, 0o755);
    console.log(`Bundled moli ${VERSION} at ${destination}`);
  } finally {
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`prepareMoliResources failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
