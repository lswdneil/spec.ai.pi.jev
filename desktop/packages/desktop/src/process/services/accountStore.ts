/**
 * Persistence for the signed-in account.
 *
 * The cloud token, local aioncore password and local session cookies are all
 * secrets. They are encrypted with Electron's safeStorage when the OS provides
 * a keyring; on Linux without one the file is written 0600 and marked as
 * plaintext so the UI can say so instead of pretending it is encrypted.
 *
 * The claim file is deliberately separate and not encrypted: it only records
 * which cloud account owns the built-in `admin` user, so losing the session
 * file cannot silently hand the old local data to a different account.
 */

import { chmodSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import type { SpecAiUser } from './accountCloud';

export type AccountRole = 'user' | 'admin';

export type LocalSessionCookies = {
  session: string;
  refresh: string;
  csrf: string;
};

export type StoredAccountSession = {
  version: 1;
  cloudToken: string;
  user: SpecAiUser;
  role: AccountRole;
  localUsername: string;
  localUserId: string;
  localPassword: string;
  cookies: LocalSessionCookies;
  adoptedSystemUser: boolean;
  createdAt: number;
  updatedAt: number;
};

export type StoredClaim = {
  version: 1;
  cloudUserId: number;
  localUsername: string;
  claimedAt: number;
};

export type StorageSecurity = {
  encryptionAvailable: boolean;
  plaintext: boolean;
};

const SESSION_FILE = 'account-session.bin';
const CLAIM_FILE = 'account-claim.json';
const ENCRYPTED_PREFIX = 'enc:v1:';
const PLAINTEXT_PREFIX = 'plain:v1:';

function userDataDir(): string {
  return app.getPath('userData');
}

function sessionPath(): string {
  return path.join(userDataDir(), SESSION_FILE);
}

function claimPath(): string {
  return path.join(userDataDir(), CLAIM_FILE);
}

function writePrivateFile(filePath: string, data: string): void {
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, data, { encoding: 'utf8', mode: 0o600 });
  try {
    chmodSync(tempPath, 0o600);
  } catch {
    // Windows uses the inherited ACL; chmod is best effort there.
  }
  try {
    renameSync(tempPath, filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES') throw error;
    // Windows can refuse an atomic replace while another process (an indexer,
    // antivirus, a backup tool) holds the destination open. Overwriting in
    // place is not atomic, but losing the session at every save is worse.
    try {
      writeFileSync(filePath, data, { encoding: 'utf8', mode: 0o600 });
    } finally {
      rmSync(tempPath, { force: true });
    }
  }
}

function encodeSession(session: StoredAccountSession): { data: string; plaintext: boolean } {
  const json = JSON.stringify(session);
  if (safeStorage.isEncryptionAvailable()) {
    return { data: ENCRYPTED_PREFIX + safeStorage.encryptString(json).toString('base64'), plaintext: false };
  }
  return { data: PLAINTEXT_PREFIX + json, plaintext: true };
}

function decodeSession(raw: string): StoredAccountSession | null {
  let json: string;
  if (raw.startsWith(ENCRYPTED_PREFIX)) {
    if (!safeStorage.isEncryptionAvailable()) return null;
    json = safeStorage.decryptString(Buffer.from(raw.slice(ENCRYPTED_PREFIX.length), 'base64'));
  } else if (raw.startsWith(PLAINTEXT_PREFIX)) {
    json = raw.slice(PLAINTEXT_PREFIX.length);
  } else {
    return null;
  }
  const parsed = JSON.parse(json) as StoredAccountSession;
  if (parsed?.version !== 1 || typeof parsed.cloudToken !== 'string' || !parsed.user) return null;
  return parsed;
}

export function getStorageSecurity(): StorageSecurity {
  return {
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
    plaintext: !safeStorage.isEncryptionAvailable(),
  };
}

export function loadStoredSession(): StoredAccountSession | null {
  const filePath = sessionPath();
  if (!existsSync(filePath)) return null;
  try {
    return decodeSession(readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.warn('[account] stored session could not be read', error);
    return null;
  }
}

export function saveStoredSession(session: StoredAccountSession): StorageSecurity {
  const encoded = encodeSession(session);
  writePrivateFile(sessionPath(), encoded.data);
  return { encryptionAvailable: safeStorage.isEncryptionAvailable(), plaintext: encoded.plaintext };
}

/**
 * Remove the credentials but keep the claim. Logging out must not free the
 * built-in admin user for another cloud account to claim.
 */
export function clearStoredSession(): void {
  rmSync(sessionPath(), { force: true });
}

export function loadClaim(): StoredClaim | null {
  const filePath = claimPath();
  if (!existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as StoredClaim;
    if (parsed?.version !== 1 || typeof parsed.cloudUserId !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveClaim(claim: StoredClaim): void {
  writePrivateFile(claimPath(), `${JSON.stringify(claim, null, 2)}\n`);
}

/** Only for an explicit account reset, never for a normal sign-out. */
export function clearClaim(): void {
  rmSync(claimPath(), { force: true });
}

export function sessionFilePath(): string {
  return sessionPath();
}
