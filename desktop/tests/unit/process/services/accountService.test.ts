import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => os.tmpdir(),
  },
  session: {
    defaultSession: {
      webRequest: { onBeforeSendHeaders: vi.fn() },
      cookies: { remove: vi.fn().mockResolvedValue(undefined) },
    },
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString('utf8'),
  },
}));

vi.mock('@/process/backend', () => ({ resolveBinaryPath: () => 'aioncore' }));
vi.mock('@/process/utils/utils', () => ({ getDataPath: () => os.tmpdir() }));

import { getAccountBootState, localUsernameFor, resolveCloudRole } from '@/process/services/accountService';
import type { SpecAiUser } from '@/process/services/accountCloud';
import type { StoredClaim } from '@/process/services/accountStore';

const adminEmail = 'devneil@spec-ai.cn';

function user(overrides: Partial<SpecAiUser> = {}): SpecAiUser {
  return {
    id: 7,
    email: 'person@example.com',
    phone: null,
    plan: 'free',
    planExpiresAt: null,
    hasPassword: true,
    createdAt: 1,
    ...overrides,
  };
}

function claim(overrides: Partial<StoredClaim> = {}): StoredClaim {
  return {
    version: 1,
    cloudUserId: 7,
    localUsername: 'cloud_7',
    claimedAt: 1,
    ...overrides,
  };
}

describe('cloud account role resolution', () => {
  afterEach(() => {
    delete process.env.SPECJEV_ADMIN_EMAILS;
    delete process.env.SPECJEV_ADMIN_CLOUD_IDS;
  });

  it('makes the bundled administrator email an administrator, case-insensitively', () => {
    expect(resolveCloudRole(user({ email: adminEmail }))).toBe('admin');
    expect(resolveCloudRole(user({ email: adminEmail.toUpperCase() }))).toBe('admin');
  });

  it('keeps ordinary accounts as users', () => {
    expect(resolveCloudRole(user())).toBe('user');
    expect(resolveCloudRole(user({ email: null, phone: '+8613800000000' }))).toBe('user');
  });

  it('honours additional administrator emails from the environment', () => {
    process.env.SPECJEV_ADMIN_EMAILS = 'ops@example.com, second@example.com';
    expect(resolveCloudRole(user({ email: 'OPS@example.com' }))).toBe('admin');
    expect(resolveCloudRole(user({ email: 'second@example.com' }))).toBe('admin');
  });

  it('honours administrator cloud ids from the environment', () => {
    process.env.SPECJEV_ADMIN_CLOUD_IDS = '42, 99';
    expect(resolveCloudRole(user({ id: 42, email: null, phone: '+8613800000000' }))).toBe('admin');
    expect(resolveCloudRole(user({ id: 7 }))).toBe('user');
  });
});

describe('local account mapping', () => {
  it('gives the first cloud account on an installation the built-in admin user', () => {
    expect(localUsernameFor(user(), null)).toEqual({ username: 'admin', adoptedSystemUser: true });
  });

  it('restores the local user recorded by the claim', () => {
    expect(localUsernameFor(user(), claim())).toEqual({
      username: 'cloud_7',
      adoptedSystemUser: false,
    });
    expect(localUsernameFor(user({ id: 3 }), claim({ cloudUserId: 3, localUsername: 'admin' }))).toEqual({
      username: 'admin',
      adoptedSystemUser: true,
    });
  });

  it('never hands the claimed local user to a different cloud account', () => {
    expect(localUsernameFor(user({ id: 9 }), claim())).toEqual({
      username: 'cloud_9',
      adoptedSystemUser: false,
    });
  });
});

describe('account boot state', () => {
  it('starts in local mode in an unpackaged build', () => {
    expect(getAccountBootState()).toEqual({ required: false, authenticated: true });
  });
});
