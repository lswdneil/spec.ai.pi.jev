/**
 * Stages a portable CPython under resources/bundled-python/<platform>-<arch>/.
 *
 * Windows ships no Python: the `python` name is a Store alias until someone
 * installs one. The docx skill and stack-diagram run Python scripts, so the app
 * carries an interpreter and puts its folder first on PATH for the agent. The
 * build installs python-docx into it; the person's machine downloads nothing.
 *
 * Source: astral-sh/python-build-standalone (MPL-2.0, unmodified binaries). The
 * archive is pinned and its SHA-256 checked. MU_BUNDLED_PYTHON_ARCHIVE may name
 * a local archive for offline builds; MU_SKIP_BUNDLED_PYTHON=1 builds without
 * the interpreter (docx then needs a system Python).
 */
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createWriteStream, createReadStream, promises: fs } = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');

const STANDALONE_BUILD = '20261026';
const PYTHON_VERSION = '3.12.16';
const PACKAGES = ['python-docx==1.2.0'];
const DOWNLOAD_TIMEOUT_MS = 120_000;
const DOWNLOAD_ATTEMPTS = 2;

const ASSETS = {
  'win32-x64': {
    name: `cpython-${PYTHON_VERSION}+${STANDALONE_BUILD}-x86_64-pc-windows-msvc-install_only_stripped.tar.gz`,
    sha256: '1f2ab53880fc67ea323398c6388e05af28addc99a8e389209f08a51fdff4b149',
  },
};

function option(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function download(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error(`Too many redirects for ${url}`));
      return;
    }
    const request = https
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
    // GitHub's release CDN occasionally accepts the request and then stops sending. Without this
    // the build waits forever; the caller retries and the message names the URL.
    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => request.destroy(new Error(`timed out downloading ${url}`)));
  });
}

async function downloadWithRetry(url, destination) {
  let lastError;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      await download(url, destination);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Download attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw lastError;
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function pythonExecutable(root) {
  return path.join(root, 'python.exe');
}

function pipInstall(python, packages) {
  execFileSync(
    python,
    [
      '-m',
      'pip',
      'install',
      '--no-cache-dir',
      '--no-input',
      '--no-warn-script-location',
      '--disable-pip-version-check',
      ...packages,
    ],
    { stdio: 'inherit', env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' } }
  );
}

function installedVersions(python) {
  const script =
    'import importlib.metadata as m, json;' +
    " print(json.dumps({n: m.version(n) for n in ['python-docx', 'lxml', 'typing-extensions']}))";
  const output = execFileSync(python, ['-c', script], { encoding: 'utf8' }).trim();
  return JSON.parse(output);
}

function verifyDocx(python) {
  execFileSync(python, ['-c', 'import docx'], { stdio: 'inherit' });
}

async function directorySize(dir) {
  let bytes = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) bytes += await directorySize(full);
    else if (entry.isFile()) bytes += (await fs.stat(full)).size;
  }
  return bytes;
}

async function upToDate(destination) {
  const manifestPath = path.join(destination, 'manifest.json');
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (manifest.standaloneBuild !== STANDALONE_BUILD || manifest.python !== PYTHON_VERSION) return false;
    if (!Array.isArray(manifest.requestedPackages)) return false;
    if (manifest.requestedPackages.join(',') !== PACKAGES.join(',')) return false;
    const python = pythonExecutable(destination);
    await fs.access(python);
    await fs.access(path.join(destination, 'python3.exe'));
    verifyDocx(python);
    return true;
  } catch {
    return false;
  }
}

function notices(installed) {
  return [
    '# Third-party notices: bundled Python',
    '',
    'This folder is a portable CPython runtime staged at build time. The app puts',
    'it first on PATH so the built-in docx and stack-diagram skills run without a',
    'Python installation on the machine.',
    '',
    '| Component | Version | Licence |',
    '| --- | --- | --- |',
    `| python-build-standalone | ${STANDALONE_BUILD} | MPL-2.0 (LICENSE-MPL-2.0.txt) |`,
    `| CPython | ${PYTHON_VERSION} | PSF-2.0 (LICENSE.txt in this folder) |`,
    `| python-docx | ${installed['python-docx']} | MIT (Lib/site-packages/python_docx-*.dist-info/LICENSE) |`,
    `| lxml | ${installed.lxml} | BSD-3-Clause (Lib/site-packages/lxml-*.dist-info/LICENSE.txt) |`,
    `| typing_extensions | ${installed['typing-extensions']} | PSF-2.0 (Lib/site-packages/typing_extensions-*.dist-info/LICENSE) |`,
    '',
    'The interpreter is unmodified. Its source is published at',
    'https://github.com/astral-sh/python-build-standalone (tag ' + STANDALONE_BUILD + ').',
    '',
  ].join('\n');
}

async function main() {
  const platform = option('platform') || process.platform;
  const arch = option('arch') || process.arch;
  const runtimeKey = `${platform}-${arch}`;
  const asset = ASSETS[runtimeKey];
  const projectRoot = path.resolve(__dirname, '..');
  const destination = path.join(projectRoot, 'resources', 'bundled-python', runtimeKey);

  if (!asset) {
    console.warn(`No pinned portable Python for ${runtimeKey}: the docx skill needs a system Python there.`);
    return;
  }
  if (process.env.MU_SKIP_BUNDLED_PYTHON === '1') {
    console.warn('MU_SKIP_BUNDLED_PYTHON=1: the installer will not carry Python.');
    return;
  }
  if (await upToDate(destination)) {
    console.log(`Bundled Python ${PYTHON_VERSION} is up to date at ${destination}`);
    return;
  }

  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'specjev-python-'));
  try {
    const archive = path.join(work, asset.name);
    const supplied = process.env.MU_BUNDLED_PYTHON_ARCHIVE;
    if (supplied) {
      await fs.copyFile(path.resolve(supplied), archive);
    } else {
      const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${STANDALONE_BUILD}/${asset.name}`;
      console.log(`Downloading ${url}`);
      await downloadWithRetry(url, archive);
    }

    const actual = await digest(archive);
    if (actual !== asset.sha256) {
      throw new Error(`SHA-256 mismatch for ${asset.name}: expected ${asset.sha256}, got ${actual}`);
    }

    const extracted = path.join(work, 'extracted');
    await fs.mkdir(extracted, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', extracted], { stdio: 'inherit' });
    const source = path.join(extracted, 'python');
    await fs.access(pythonExecutable(source));

    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, { recursive: true });

    const python = pythonExecutable(destination);
    pipInstall(python, PACKAGES);
    await fs.copyFile(python, path.join(destination, 'python3.exe'));
    verifyDocx(python);

    await fs.copyFile(
      path.join(__dirname, 'python', 'LICENSE-MPL-2.0.txt'),
      path.join(destination, 'LICENSE-MPL-2.0.txt')
    );
    const installed = installedVersions(python);
    await fs.writeFile(path.join(destination, 'THIRD-PARTY-NOTICES.md'), notices(installed), 'utf8');
    await fs.writeFile(
      path.join(destination, 'manifest.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          runtimeKey,
          python: PYTHON_VERSION,
          standaloneBuild: STANDALONE_BUILD,
          source: 'astral-sh/python-build-standalone',
          requestedPackages: PACKAGES,
          installed,
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const megabytes = (await directorySize(destination)) / 1024 / 1024;
    console.log(`Bundled Python ${PYTHON_VERSION} with python-docx at ${destination} (${megabytes.toFixed(1)} MB)`);
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`preparePythonResources failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
