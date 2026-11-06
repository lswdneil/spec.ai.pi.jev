#!/usr/bin/env node
/**
 * Phase A spike for the account work: run aioncore in webui identity mode
 * against a throwaway data directory and prove the transport and per-user
 * isolation the desktop app will rely on.
 *
 * This script never prints passwords, JWTs, cookies or CSRF tokens. It is a
 * development tool and is not part of the packaged app.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

const DEFAULT_BIN = path.resolve('resources/bundled-aioncore/win32-x64/aioncore.exe');
const BIN = process.env.AIONCORE_BIN || DEFAULT_BIN;
const DATA_DIR = mkdtempSync(path.join(tmpdir(), 'specjev-auth-spike-'));
const PORT = 26100 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const results = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

function requireOk(name, ok, detail = '') {
  record(name, ok, detail);
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
}

function runCli(args, password) {
  const child = spawnSync(BIN, ['--data-dir', DATA_DIR, 'user', ...args], {
    input: `${password}\n`,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (child.status !== 0) {
    throw new Error(`aioncore user ${args.join(' ')} failed: ${child.stderr || child.stdout}`);
  }
  return child.stdout;
}

function newPassword() {
  return randomBytes(18).toString('base64url');
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      // The backend has not bound its port yet.
    }
    await sleep(200);
  }
  throw new Error(`aioncore did not answer /health on ${BASE}`);
}

function cookieHeader(response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
}

function cookieValue(cookie, name) {
  const prefix = `${name}=`;
  const part = cookie.split(';').find((item) => item.trim().startsWith(prefix));
  return part ? part.trim().slice(prefix.length) : '';
}

async function login(username, password) {
  const response = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json();
  return {
    response,
    body,
    cookie: cookieHeader(response),
    csrf: cookieValue(cookieHeader(response), 'aionui-csrf-token'),
  };
}

async function api(pathname, { method = 'GET', cookie = '', csrf = '', token = '', body } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return response;
}

async function jsonData(response) {
  const body = await response.json();
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function probeWebSocket(url, headers, waitMs = 0) {
  return new Promise((resolve) => {
    const socket = new WebSocket(url, { headers });
    const messages = [];
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(openTimer);
      clearTimeout(waitTimer);
      resolve(result);
    };
    const openTimer = setTimeout(() => {
      socket.terminate();
      finish({ opened: false, closeCode: 0, timedOut: true, messages });
    }, 5000);
    let waitTimer;
    socket.on('open', () => {
      clearTimeout(openTimer);
      if (waitMs === 0) {
        socket.close();
        finish({ opened: true, closeCode: 0, timedOut: false, messages });
        return;
      }
      waitTimer = setTimeout(() => {
        socket.close();
        finish({ opened: true, closeCode: 0, timedOut: false, messages });
      }, waitMs);
    });
    socket.on('message', (data) => {
      const text = data.toString();
      try {
        messages.push(JSON.parse(text));
      } catch {
        messages.push(text.slice(0, 200));
      }
    });
    socket.on('unexpected-response', (_request, response) => {
      finish({ opened: false, closeCode: 0, timedOut: false, status: response.statusCode, messages });
    });
    socket.on('error', () => {
      finish({ opened: false, closeCode: 0, timedOut: false, messages });
    });
    socket.on('close', (code) => {
      finish({ opened: false, closeCode: code, timedOut: false, messages });
    });
  });
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) return;
    await sleep(100);
  }
  child.kill('SIGKILL');
}

function assertSafeCleanup(dir) {
  const tempRoot = `${path.resolve(tmpdir()).toLowerCase()}${path.sep}`;
  const target = path.resolve(dir);
  const inside = target.toLowerCase().startsWith(tempRoot);
  const named = path.basename(target).startsWith('specjev-auth-spike-');
  if (!inside || !named) throw new Error(`refusing to remove unexpected directory: ${target}`);
}

let server;
try {
  requireOk('aioncore binary exists', existsSync(BIN), BIN);

  server = spawn(
    BIN,
    ['--port', String(PORT), '--data-dir', DATA_DIR, '--identity-mode', 'webui', '--log-level', 'warn'],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  );
  let serverOutput = '';
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.on('exit', (code) => {
    if (code !== 0 && code !== null) serverOutput += `\n[aioncore exit ${code}]`;
  });

  await waitForHealth();
  record('webui backend answers /health', true);

  const userA = 'spike_a';
  const userB = 'spike_b';
  const passwordA = newPassword();
  const passwordB = newPassword();
  const adminPassword = newPassword();

  const createdA = runCli(['create', '--username', userA, '--password-stdin'], passwordA);
  const createdB = runCli(['create', '--username', userB, '--password-stdin'], passwordB);
  runCli(['set-password', '--password-stdin'], adminPassword);
  requireOk('created two local users', /spike_a/.test(createdA) && /spike_b/.test(createdB));
  record('set-password on built-in admin succeeds', true);

  const listed = runCli(['list']);
  requireOk('user list contains both users', listed.includes(userA) && listed.includes(userB));

  const loginA = await login(userA, passwordA);
  const loginB = await login(userB, passwordB);
  const loginAdmin = await login('admin', adminPassword);
  requireOk('user A login succeeds', loginA.response.ok && loginA.body?.success === true);
  requireOk('user B login succeeds', loginB.response.ok && loginB.body?.success === true);
  requireOk('built-in admin login succeeds with set password', loginAdmin.response.ok && loginAdmin.body?.success === true);
  requireOk('login returns a local JWT', Boolean(loginA.body?.token));
  requireOk('login sets a session cookie', Boolean(cookieValue(loginA.cookie, 'aionui-session')));
  requireOk('login sets a CSRF cookie', Boolean(loginA.csrf));

  const currentA = await api('/api/system/current-user', { cookie: loginA.cookie });
  const currentABody = await jsonData(currentA);
  requireOk('current-user with cookie is 200', currentA.status === 200, `status=${currentA.status}`);
  requireOk('current-user matches user A', currentABody?.id === loginA.body?.user?.id);

  const bearerA = await api('/api/system/current-user', { token: loginA.body.token });
  const bearerBody = await jsonData(bearerA);
  requireOk('current-user accepts Bearer token', bearerA.status === 200 && bearerBody?.id === loginA.body?.user?.id);

  const anonymous = await api('/api/system/current-user');
  requireOk('current-user without credentials is 401', anonymous.status === 401, `status=${anonymous.status}`);

  const noCsrf = await api('/api/settings/client', {
    method: 'PUT',
    cookie: loginA.cookie,
    body: { 'spike.owner': 'A' },
  });
  record('cookie-only write is rejected', noCsrf.status === 403 || noCsrf.status === 401, `status=${noCsrf.status}`);

  const writeA = await api('/api/settings/client', {
    method: 'PUT',
    cookie: loginA.cookie,
    csrf: loginA.csrf,
    body: { 'spike.owner': 'A' },
  });
  requireOk('cookie + CSRF write succeeds', writeA.ok, `status=${writeA.status}`);

  const readA = await jsonData(await api('/api/settings/client', { cookie: loginA.cookie }));
  requireOk('user A reads its own setting', readA?.['spike.owner'] === 'A', JSON.stringify(readA));

  const readBBefore = await jsonData(await api('/api/settings/client', { cookie: loginB.cookie }));
  requireOk(
    'user B cannot read user A setting',
    readBBefore?.['spike.owner'] !== 'A',
    JSON.stringify(readBBefore)
  );

  const writeB = await api('/api/settings/client', {
    method: 'PUT',
    cookie: loginB.cookie,
    csrf: loginB.csrf,
    body: { 'spike.owner': 'B' },
  });
  requireOk('user B writes its own setting', writeB.ok, `status=${writeB.status}`);

  const readAAfter = await jsonData(await api('/api/settings/client', { cookie: loginA.cookie }));
  requireOk('user A setting is unchanged by user B', readAAfter?.['spike.owner'] === 'A');

  const socketA = await probeWebSocket(`ws://127.0.0.1:${PORT}/ws`, { cookie: loginA.cookie });
  requireOk('WebSocket opens with session cookie', socketA.opened === true, JSON.stringify(socketA));

  const socketAnonymous = await probeWebSocket(`ws://127.0.0.1:${PORT}/ws`, {}, 2000);
  const anonymousAuthError = socketAnonymous.messages.some(
    (message) =>
      message &&
      typeof message === 'object' &&
      message.name === 'realtime.error' &&
      (message.data?.code === 'REALTIME_AUTH_MISSING' || message.data?.code === 'REALTIME_AUTH_EXPIRED')
  );
  record(
    'WebSocket without credentials gets an auth error',
    anonymousAuthError,
    JSON.stringify(socketAnonymous)
  );

  const logout = await api('/logout', {
    method: 'POST',
    cookie: loginA.cookie,
    csrf: loginA.csrf,
  });
  record('logout succeeds', logout.ok, `status=${logout.status}`);
  const afterLogout = await api('/api/system/current-user', { cookie: loginA.cookie });
  record('session cookie is invalid after logout', afterLogout.status === 401, `status=${afterLogout.status}`);

  if (serverOutput.trim()) record('aioncore warnings', true, serverOutput.trim().slice(0, 500));
} catch (error) {
  record('spike failed', false, error instanceof Error ? error.message : String(error));
} finally {
  if (server) await stopServer(server);
  try {
    assertSafeCleanup(DATA_DIR);
    rmSync(DATA_DIR, { recursive: true, force: true });
  } catch (error) {
    record('cleanup', false, error instanceof Error ? error.message : String(error));
  }
}

const passed = results.filter((item) => item.ok).length;
console.log(JSON.stringify({ passed, total: results.length, results }, null, 2));
if (passed !== results.length) process.exitCode = 1;
