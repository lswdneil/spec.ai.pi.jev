/**
 * Phase A spike for the packaged renderer: load a file:// page (the same kind
 * of origin the packaged app uses), sign in to a real aioncore in webui mode,
 * and prove Electron stores the session cookie and sends it on the next fetch.
 *
 * Passwords and cookie values are never printed. The data directory is a
 * throwaway under the system temp directory.
 */

const { app, BrowserWindow, session } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');

const BIN =
  process.env.AIONCORE_BIN || path.resolve(__dirname, '../resources/bundled-aioncore/win32-x64/aioncore.exe');
const DATA_DIR = mkdtempSync(path.join(os.tmpdir(), 'specjev-electron-auth-spike-'));
const PORT = 26600 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const USER = 'spike_electron';
const PASSWORD = randomBytes(18).toString('base64url');
const results = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

function runCli(args, password) {
  const child = spawnSync(BIN, ['--data-dir', DATA_DIR, 'user', ...args], {
    input: `${password}\n`,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (child.status !== 0) throw new Error(`aioncore user ${args.join(' ')} failed: ${child.stderr || child.stdout}`);
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(200);
  }
  throw new Error(`aioncore did not answer /health on ${BASE}`);
}

function assertSafeCleanup(dir) {
  const tempRoot = `${path.resolve(os.tmpdir()).toLowerCase()}${path.sep}`;
  const target = path.resolve(dir);
  if (!target.toLowerCase().startsWith(tempRoot) || !path.basename(target).startsWith('specjev-electron-auth-spike-')) {
    throw new Error(`refusing to remove unexpected directory: ${target}`);
  }
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) return;
    await sleep(100);
  }
  child.kill('SIGKILL');
}

let server;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  try {
    record('aioncore binary exists', existsSync(BIN), BIN);
    server = spawn(
      BIN,
      ['--port', String(PORT), '--data-dir', DATA_DIR, '--identity-mode', 'webui', '--log-level', 'warn'],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );
    server.stdout.on('data', () => {});
    server.stderr.on('data', () => {});

    await waitForHealth();
    runCli(['create', '--username', USER, '--password-stdin'], PASSWORD);
    record('created local user', true);

    const loginResponse = await fetch(`${BASE}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: USER, password: PASSWORD }),
    });
    const loginBody = await loginResponse.json();
    const setCookies = loginResponse.headers.getSetCookie();
    record('main-process login succeeds', loginResponse.ok && loginBody.success === true);
    record(
      'login sets session and CSRF cookies',
      setCookies.some((cookie) => cookie.startsWith('aionui-session=')) &&
        setCookies.some((cookie) => cookie.startsWith('aionui-csrf-token=')),
      JSON.stringify(setCookies.map((cookie) => cookie.replace(/=[^;]+/, '=REDACTED')))
    );

    for (const raw of setCookies) {
      const [pair, ...attributes] = raw.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      if (separator < 0) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const lower = attributes.map((attribute) => attribute.toLowerCase());
      await session.defaultSession.cookies.set({
        url: BASE,
        name,
        value,
        path: '/',
        httpOnly: lower.includes('httponly'),
        secure: lower.includes('secure'),
        sameSite: lower.includes('samesite=none') ? 'no_restriction' : 'lax',
      });
    }

    const storedCookies = await session.defaultSession.cookies.get({ url: BASE });
    const sessionCookie = storedCookies.find((cookie) => cookie.name === 'aionui-session');
    const csrfCookie = storedCookies.find((cookie) => cookie.name === 'aionui-csrf-token');
    record('Electron stores the session cookie', Boolean(sessionCookie), JSON.stringify(storedCookies.map((cookie) => cookie.name)));
    record('Electron stores the CSRF cookie', Boolean(csrfCookie), JSON.stringify(storedCookies.map((cookie) => cookie.name)));
    record(
      'session cookie is HttpOnly',
      Boolean(sessionCookie?.httpOnly),
      JSON.stringify({
        httpOnly: sessionCookie?.httpOnly,
        secure: sessionCookie?.secure,
        sameSite: sessionCookie?.sameSite,
      })
    );

    const csrfToken = csrfCookie?.value ?? '';
    const localToken = loginBody.token;
    const cookieHeader = setCookies
      .map((cookie) => cookie.split(';', 1)[0])
      .join('; ');

    session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${BASE}/*`] }, (details, callback) => {
      details.requestHeaders.Cookie = cookieHeader;
      details.requestHeaders['x-csrf-token'] = csrfToken;
      callback({ requestHeaders: details.requestHeaders });
    });

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    await win.loadFile(path.join(__dirname, 'spike-electron-auth-page.html'));

    const rendererResult = await win.webContents.executeJavaScript(`(async () => {
      const base = ${JSON.stringify(BASE)};
      try {
        const cookieCurrent = await fetch(base + '/api/system/current-user', { credentials: 'include' });
        const cookieBody = await cookieCurrent.json();
        const bearerCurrent = await fetch(base + '/api/system/current-user', {
          headers: { authorization: 'Bearer ' + ${JSON.stringify(localToken)} },
        });
        const bearerBody = await bearerCurrent.json();
        const bearerWrite = await fetch(base + '/api/settings/client', {
          method: 'PUT',
          headers: {
            authorization: 'Bearer ' + ${JSON.stringify(localToken)},
            'content-type': 'application/json',
          },
          body: JSON.stringify({ 'spike.electron': 'bearer' }),
        });
        const injectedWrite = await fetch(base + '/api/settings/client', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ 'spike.electron': 'injected' }),
        });
        return {
          loginUserIdPresent: Boolean(${JSON.stringify(loginBody.user?.id)}),
          cookieCurrentStatus: cookieCurrent.status,
          cookieBodyKeys: cookieBody && typeof cookieBody === 'object' ? Object.keys(cookieBody) : [],
          cookieUserHasId: Boolean(cookieBody && (cookieBody.id || cookieBody.data?.id)),
          cookieUserMatches: Boolean(
            cookieBody && (cookieBody.id || cookieBody.data?.id) === ${JSON.stringify(loginBody.user?.id)}
          ),
          bearerCurrentStatus: bearerCurrent.status,
          bearerUserHasId: Boolean(bearerBody && (bearerBody.id || bearerBody.data?.id)),
          bearerUserMatches: Boolean(
            bearerBody && (bearerBody.id || bearerBody.data?.id) === ${JSON.stringify(loginBody.user?.id)}
          ),
          bearerWriteStatus: bearerWrite.status,
          injectedWriteStatus: injectedWrite.status,
        };
      } catch (error) {
        return { error: String(error) };
      }
    })()`);

    record('renderer sends the injected session cookie', rendererResult.cookieUserMatches === true, JSON.stringify(rendererResult));
    record('renderer sends the Bearer token', rendererResult.bearerUserMatches === true, JSON.stringify(rendererResult));
    record('renderer writes with Bearer + CSRF', rendererResult.bearerWriteStatus === 200, JSON.stringify(rendererResult));
    record('renderer writes with injected Cookie + CSRF', rendererResult.injectedWriteStatus === 200, JSON.stringify(rendererResult));
  } catch (error) {
    record('spike failed', false, error instanceof Error ? error.message : String(error));
  } finally {
    await stopServer(server);
    try {
      assertSafeCleanup(DATA_DIR);
      rmSync(DATA_DIR, { recursive: true, force: true });
    } catch (error) {
      record('cleanup', false, error instanceof Error ? error.message : String(error));
    }
    const passed = results.filter((item) => item.ok).length;
    console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
    app.exit(passed === results.length ? 0 : 1);
  }
});
