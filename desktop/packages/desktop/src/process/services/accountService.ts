/**
 * Main-process account orchestration.
 *
 * The cloud says who the person is; aioncore stores what belongs to them.
 * Every cloud account is mapped to one local aioncore user, and the renderer
 * only ever receives the public identity. Cloud tokens, the generated local
 * password and the aioncore cookies never cross the preload boundary.
 */

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { session } from 'electron';
import type { AccountPublicUser, AccountRole, AccountStatus } from '@/common/types/account';
import { setCoreAuthHeadersProvider } from '@/common/adapter/httpBridge';
import {
  SpecAiError,
  fetchCloudMe,
  loginCloud,
  registerCloud,
  type SpecAiLoginParams,
  type SpecAiRegisterParams,
  type SpecAiUser,
} from './accountCloud';
import {
  clearStoredSession,
  getStorageSecurity,
  loadClaim,
  loadStoredSession,
  saveClaim,
  saveStoredSession,
  type LocalSessionCookies,
  type StoredAccountSession,
} from './accountStore';
import { resolveIdentityMode } from './identityMode';
import { resolveBinaryPath } from '../backend';
import { getDataPath } from '../utils/utils';

const DEFAULT_ADMIN_EMAILS = ['devneil@spec-ai.cn'];
const LOCAL_LOGIN_TIMEOUT_MS = 15_000;
const PROVISION_TIMEOUT_MS = 20_000;
const SESSION_COOKIE_NAMES = ['aionui-session', 'aionui-refresh', 'aionui-csrf-token'] as const;

type LocalLoginResult = {
  userId: string;
  username: string;
  token: string;
  cookies: LocalSessionCookies;
};

let identityMode = resolveIdentityMode();
let readyPromise: Promise<void> | null = null;
let currentSession: StoredAccountSession | null = null;
let status: AccountStatus = {
  required: identityMode === 'webui',
  authenticated: identityMode !== 'webui',
  user: null,
  localUserId: null,
  localUsername: null,
  lastLoginAt: null,
  offline: false,
  // safeStorage is not usable before `app.whenReady()`; initialize() replaces
  // this placeholder once Electron is ready.
  storage: { encryptionAvailable: false, plaintext: false },
};
let headerInjectionPort: number | null = null;

// Services in the main process reach aioncore through the shared HTTP helper,
// not through Chromium, so they need the account session explicitly.
setCoreAuthHeadersProvider(() => {
  const active = currentSession;
  if (!active) return null;
  return {
    cookie: cookieHeader(active.cookies),
    csrf: active.cookies.csrf,
  };
});

function backendPort(): number {
  const port = (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort;
  if (!port) throw new Error('backend is not ready');
  return port;
}

function backendBaseUrl(port = backendPort()): string {
  return `http://127.0.0.1:${port}`;
}

function publicUser(user: SpecAiUser, role: AccountRole): AccountPublicUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    hasPassword: user.hasPassword,
    createdAt: user.createdAt,
    role,
  };
}

function adminEmails(): Set<string> {
  const configured = (process.env.SPECJEV_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS.map((value) => value.toLowerCase()), ...configured]);
}

function adminCloudIds(): Set<number> {
  return new Set(
    (process.env.SPECJEV_ADMIN_CLOUD_IDS ?? '')
      .split(',')
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isFinite(value))
  );
}

/**
 * Administrator status is decided here, in the main process. The renderer
 * never sees the allow-list and cannot make itself an administrator.
 */
export function resolveCloudRole(user: SpecAiUser): AccountRole {
  if (adminCloudIds().has(user.id)) return 'admin';
  const email = user.email?.trim().toLowerCase();
  return email && adminEmails().has(email) ? 'admin' : 'user';
}

function setStatus(next: Partial<AccountStatus>): AccountStatus {
  status = {
    ...status,
    required: identityMode === 'webui',
    ...next,
    storage: getStorageSecurity(),
  };
  return status;
}

function authenticatedStatus(sessionValue: StoredAccountSession, offline: boolean): AccountStatus {
  currentSession = sessionValue;
  return setStatus({
    authenticated: true,
    user: publicUser(sessionValue.user, sessionValue.role),
    localUserId: sessionValue.localUserId,
    localUsername: sessionValue.localUsername,
    lastLoginAt: sessionValue.createdAt,
    offline,
  });
}

function unauthenticatedStatus(): AccountStatus {
  currentSession = null;
  return setStatus({
    authenticated: false,
    user: null,
    localUserId: null,
    localUsername: null,
    lastLoginAt: null,
    offline: false,
  });
}

function cookieHeader(cookies: LocalSessionCookies): string {
  const parts = [`aionui-session=${cookies.session}`, `aionui-csrf-token=${cookies.csrf}`];
  return parts.join('; ');
}

function localFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${backendBaseUrl()}${pathname}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(LOCAL_LOGIN_TIMEOUT_MS),
  });
}

function readSetCookies(response: Response): LocalSessionCookies {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const raw = headers.getSetCookie?.() ?? [];
  const values = new Map<string, string>();
  for (const cookie of raw) {
    const pair = cookie.split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    values.set(pair.slice(0, separator).trim(), pair.slice(separator + 1));
  }
  return {
    session: values.get('aionui-session') ?? '',
    refresh: values.get('aionui-refresh') ?? '',
    csrf: values.get('aionui-csrf-token') ?? '',
  };
}

async function localLogin(username: string, password: string): Promise<LocalLoginResult> {
  const response = await localFetch('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`local login failed (${response.status})`);
  const body = (await response.json()) as {
    success?: boolean;
    token?: string;
    user?: { id?: string; username?: string };
  };
  if (body.success !== true || !body.user?.id) throw new Error('local login returned no user');
  const cookies = readSetCookies(response);
  if (!cookies.session || !cookies.csrf) throw new Error('local login returned no session cookies');
  return {
    userId: body.user.id,
    username: body.user.username ?? username,
    token: body.token ?? '',
    cookies,
  };
}

async function currentLocalUser(cookies: LocalSessionCookies): Promise<{ id: string; username?: string }> {
  const response = await localFetch('/api/system/current-user', {
    headers: {
      cookie: cookieHeader(cookies),
      'x-csrf-token': cookies.csrf,
    },
  });
  if (!response.ok) throw new Error(`current-user failed (${response.status})`);
  return (await response.json()) as { id: string; username?: string };
}

function sanitizeProvisionOutput(value: string, password: string): string {
  return value.split(password).join('[redacted]').slice(0, 600);
}

function setLocalPassword(binaryPath: string, dataDir: string, username: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      binaryPath,
      ['--data-dir', dataDir, 'user', 'set-password', '--username', username, '--password-stdin'],
      { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true }
    );
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error('provision timed out'));
    }, PROVISION_TIMEOUT_MS);
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 4_000) stderr += chunk.toString();
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`provision failed (${code}): ${sanitizeProvisionOutput(stderr, password)}`));
    });
    child.stdin?.end(`${password}\n`);
  });
}

/**
 * Register the request interceptor that makes the file:// renderer carry the
 * aioncore session. Chromium does not attach a SameSite=Lax cookie to these
 * cross-site requests, so the main process writes the header itself.
 */
function installHeaderInjection(port: number): void {
  if (headerInjectionPort === port) return;
  headerInjectionPort = port;
  const base = backendBaseUrl(port);
  const urls = [`${base}/*`, `ws://127.0.0.1:${port}/*`];
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls }, (details, callback) => {
    const active = currentSession;
    if (!active) {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }
    details.requestHeaders.Cookie = cookieHeader(active.cookies);
    details.requestHeaders['x-csrf-token'] = active.cookies.csrf;
    callback({ requestHeaders: details.requestHeaders });
  });
}

async function clearBrowserCookies(): Promise<void> {
  const port = headerInjectionPort ?? backendPort();
  const base = backendBaseUrl(port);
  await Promise.all(
    SESSION_COOKIE_NAMES.map((name) => session.defaultSession.cookies.remove(base, name).catch((): void => undefined))
  );
}

/**
 * Best-effort local sign-out. The cloud is the authority for the account, but
 * the aioncore session must also be revoked so a copied cookie cannot keep
 * reading the previous account's data on this computer.
 */
async function localLogout(cookies: LocalSessionCookies): Promise<void> {
  try {
    const response = await localFetch('/logout', {
      method: 'POST',
      headers: {
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.csrf,
      },
    });
    if (!response.ok && response.status !== 401) {
      console.warn(`[account] local logout returned ${response.status}`);
    }
  } catch (error) {
    console.warn('[account] local logout could not be completed', error);
  }
}

export function localUsernameFor(
  user: SpecAiUser,
  claim: ReturnType<typeof loadClaim>
): {
  username: string;
  adoptedSystemUser: boolean;
} {
  if (claim && claim.cloudUserId === user.id) {
    return { username: claim.localUsername, adoptedSystemUser: claim.localUsername === 'admin' };
  }
  if (!claim) {
    // The first account on this installation inherits the built-in admin user,
    // and with it the data that belonged to the pre-account installation.
    return { username: 'admin', adoptedSystemUser: true };
  }
  return { username: `cloud_${user.id}`, adoptedSystemUser: false };
}

async function adoptCloudUser(user: SpecAiUser, cloudToken: string): Promise<AccountStatus> {
  const claim = loadClaim();
  const { username, adoptedSystemUser } = localUsernameFor(user, claim);
  const localPassword = randomBytes(24).toString('base64url');
  const port = backendPort();

  await setLocalPassword(resolveBinaryPath(), getDataPath(), username, localPassword);
  const login = await localLogin(username, localPassword);
  const role = resolveCloudRole(user);
  const now = Date.now();
  const sessionValue: StoredAccountSession = {
    version: 1,
    cloudToken,
    user,
    role,
    localUsername: login.username,
    localUserId: login.userId,
    localPassword,
    cookies: login.cookies,
    adoptedSystemUser,
    createdAt: now,
    updatedAt: now,
  };

  if (!claim && adoptedSystemUser) {
    saveClaim({
      version: 1,
      cloudUserId: user.id,
      localUsername: login.username,
      claimedAt: now,
    });
  }
  try {
    saveStoredSession(sessionValue);
  } catch (error) {
    // The session still works for this run; the next start will ask again.
    console.warn('[account] could not persist the session', error);
  }
  installHeaderInjection(port);
  return authenticatedStatus(sessionValue, false);
}

async function restoreSession(stored: StoredAccountSession): Promise<AccountStatus> {
  let offline = false;
  let user = stored.user;
  try {
    user = await fetchCloudMe(stored.cloudToken);
  } catch (error) {
    if (error instanceof SpecAiError && (error.status === 401 || error.status === 403)) {
      clearStoredSession();
      return unauthenticatedStatus();
    }
    // A network outage must not lock a person out of their local data.
    offline = true;
  }

  const role = resolveCloudRole(user);
  let cookies = stored.cookies;
  try {
    const current = await currentLocalUser(cookies);
    stored.localUserId = current.id;
  } catch {
    // The local session cookie expired: sign in again with the generated
    // password that is kept encrypted beside it.
    try {
      const login = await localLogin(stored.localUsername, stored.localPassword);
      cookies = login.cookies;
      stored.localUserId = login.userId;
    } catch {
      clearStoredSession();
      return unauthenticatedStatus();
    }
  }

  const next: StoredAccountSession = {
    ...stored,
    user,
    role,
    cookies,
    updatedAt: Date.now(),
  };
  if (next.adoptedSystemUser && !loadClaim()) {
    saveClaim({
      version: 1,
      cloudUserId: user.id,
      localUsername: next.localUsername,
      claimedAt: Date.now(),
    });
  }
  try {
    saveStoredSession(next);
  } catch (error) {
    console.warn('[account] could not persist the refreshed session', error);
  }
  installHeaderInjection(backendPort());
  return authenticatedStatus(next, offline);
}

async function initialize(): Promise<void> {
  identityMode = resolveIdentityMode();
  if (identityMode !== 'webui') {
    setStatus({ required: false, authenticated: true });
    return;
  }
  setStatus({ required: true });
  const stored = loadStoredSession();
  if (!stored) {
    unauthenticatedStatus();
    return;
  }
  await restoreSession(stored);
}

export function ensureAccountReady(): Promise<void> {
  if (!readyPromise) readyPromise = initialize();
  return readyPromise;
}

/** Synchronous boot state used by the preload to decide whether config may load. */
export function getAccountBootState(): { required: boolean; authenticated: boolean } {
  // Keep this in step with the mode the module resolved at load. The preload
  // calls it synchronously, before the first status request.
  const required = identityMode === 'webui';
  return {
    required,
    authenticated: !required || status.authenticated,
  };
}

export async function getAccountStatus(): Promise<AccountStatus> {
  await ensureAccountReady();
  return status;
}

export async function loginAccount(params: SpecAiLoginParams): Promise<AccountStatus> {
  await ensureAccountReady();
  const result = await loginCloud(params);
  return adoptCloudUser(result.user, result.token);
}

export async function registerAccount(params: SpecAiRegisterParams): Promise<AccountStatus> {
  await ensureAccountReady();
  const result = await registerCloud(params);
  return adoptCloudUser(result.user, result.token);
}

export async function logoutAccount(): Promise<void> {
  const active = currentSession;
  currentSession = null;
  clearStoredSession();
  if (active) await localLogout(active.cookies);
  await clearBrowserCookies();
  unauthenticatedStatus();
}

export async function refreshLocalAccountSession(): Promise<AccountStatus> {
  await ensureAccountReady();
  if (!currentSession) return unauthenticatedStatus();
  const login = await localLogin(currentSession.localUsername, currentSession.localPassword);
  const next: StoredAccountSession = {
    ...currentSession,
    localUserId: login.userId,
    cookies: login.cookies,
    updatedAt: Date.now(),
  };
  saveStoredSession(next);
  installHeaderInjection(backendPort());
  return authenticatedStatus(next, status.offline);
}

/** Replace the cached cloud user (after a bind) and keep the stored session in step. */
export async function updateCloudUser(user: SpecAiUser): Promise<AccountStatus> {
  if (!currentSession) return status;
  const next: StoredAccountSession = {
    ...currentSession,
    user,
    role: resolveCloudRole(user),
    updatedAt: Date.now(),
  };
  saveStoredSession(next);
  return authenticatedStatus(next, status.offline);
}

export function activeCloudToken(): string | null {
  return currentSession?.cloudToken ?? null;
}

export function clearAccountStateForTests(): void {
  readyPromise = null;
  currentSession = null;
  headerInjectionPort = null;
  status = {
    required: identityMode === 'webui',
    authenticated: identityMode !== 'webui',
    user: null,
    localUserId: null,
    localUsername: null,
    lastLoginAt: null,
    offline: false,
    storage: { encryptionAvailable: false, plaintext: false },
  };
}
