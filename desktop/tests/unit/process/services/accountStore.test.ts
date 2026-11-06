import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { electronState, fsState } = vi.hoisted(() => ({
  electronState: {
    userDataDir: '',
    encryptionAvailable: true,
  },
  fsState: {
    renameError: null as NodeJS.ErrnoException | null,
  },
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    renameSync: (from: string, to: string) => {
      const failure = fsState.renameError;
      if (failure) {
        fsState.renameError = null;
        throw failure;
      }
      return actual.renameSync(from, to);
    },
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => electronState.userDataDir,
  },
  safeStorage: {
    isEncryptionAvailable: () => electronState.encryptionAvailable,
    encryptString: (value: string) => Buffer.from(`sealed:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^sealed:/, ''),
  },
}));

import {
  clearClaim,
  clearStoredSession,
  getStorageSecurity,
  loadClaim,
  loadStoredSession,
  saveClaim,
  saveStoredSession,
  sessionFilePath,
  type StoredAccountSession,
} from '@/process/services/accountStore';

function session(overrides: Partial<StoredAccountSession> = {}): StoredAccountSession {
  return {
    version: 1,
    cloudToken: 'cloud-token',
    user: {
      id: 7,
      email: 'person@example.com',
      phone: null,
      plan: 'free',
      planExpiresAt: null,
      hasPassword: true,
      createdAt: 1,
    },
    role: 'user',
    localUsername: 'cloud_7',
    localUserId: 'local-7',
    localPassword: 'local-password',
    cookies: { session: 's', refresh: 'r', csrf: 'c' },
    adoptedSystemUser: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('account credential store', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'specjev-account-store-'));
    electronState.userDataDir = tempDir;
    electronState.encryptionAvailable = true;
    fsState.renameError = null;
  });

  afterEach(() => {
    clearClaim();
    clearStoredSession();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('round-trips an encrypted session without writing secrets in plain text', () => {
    expect(saveStoredSession(session()).plaintext).toBe(false);

    const raw = readFileSync(sessionFilePath(), 'utf8');
    expect(raw.startsWith('enc:v1:')).toBe(true);
    expect(raw).not.toContain('cloud-token');
    expect(raw).not.toContain('local-password');
    expect(loadStoredSession()).toEqual(session());
  });

  it('falls back to the marked plaintext format when the OS keyring is missing', () => {
    electronState.encryptionAvailable = false;

    expect(saveStoredSession(session()).plaintext).toBe(true);
    expect(getStorageSecurity()).toEqual({ encryptionAvailable: false, plaintext: true });

    const raw = readFileSync(sessionFilePath(), 'utf8');
    expect(raw.startsWith('plain:v1:')).toBe(true);
    expect(loadStoredSession()).toEqual(session());
  });

  it('replaces an existing session and claim on every save', () => {
    saveStoredSession(session({ cloudToken: 'first-token' }));
    saveStoredSession(session({ cloudToken: 'second-token' }));
    expect(loadStoredSession()?.cloudToken).toBe('second-token');

    saveClaim({ version: 1, cloudUserId: 7, localUsername: 'admin', claimedAt: 1 });
    saveClaim({ version: 1, cloudUserId: 8, localUsername: 'cloud_8', claimedAt: 2 });
    expect(loadClaim()).toMatchObject({ cloudUserId: 8, localUsername: 'cloud_8' });
  });

  it('keeps the claim when the session is cleared on sign-out', () => {
    saveStoredSession(session());
    saveClaim({ version: 1, cloudUserId: 7, localUsername: 'admin', claimedAt: 1 });

    clearStoredSession();

    expect(loadStoredSession()).toBeNull();
    expect(loadClaim()).toMatchObject({ cloudUserId: 7, localUsername: 'admin' });
  });

  it('rejects unreadable or unversioned session files', () => {
    writeFileSync(sessionFilePath(), 'not-a-session', 'utf8');
    expect(loadStoredSession()).toBeNull();

    writeFileSync(sessionFilePath(), `plain:v1:${JSON.stringify({ ...session(), version: 2 })}`, 'utf8');
    expect(loadStoredSession()).toBeNull();
  });

  it('overwrites in place when Windows refuses the atomic rename', () => {
    saveStoredSession(session({ cloudToken: 'first-token' }));

    const failure = new Error('EPERM: operation not permitted') as NodeJS.ErrnoException;
    failure.code = 'EPERM';
    fsState.renameError = failure;

    expect(() => saveStoredSession(session({ cloudToken: 'second-token' }))).not.toThrow();
    expect(loadStoredSession()?.cloudToken).toBe('second-token');
    expect(existsSync(`${sessionFilePath()}.tmp`)).toBe(false);
  });

  it('still surfaces a rename error that is not a Windows lock', () => {
    const failure = new Error('ENOSPC: no space left on device') as NodeJS.ErrnoException;
    failure.code = 'ENOSPC';
    fsState.renameError = failure;

    expect(() => saveStoredSession(session())).toThrow(/ENOSPC/);
  });
});
