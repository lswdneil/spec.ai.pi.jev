import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { WebUiDeviceScope } from '@/common/webui/scopes';

export const WEBUI_DEVICE_COOKIE = 'specjev_device';

const DEFAULT_CODE_TTL_MS = 5 * 60_000;
const DEFAULT_PENDING_TTL_MS = 5 * 60_000;
const DEFAULT_DELIVERY_TTL_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_NAME_LENGTH = 64;
const DEVICE_LIFETIME_MS = 30 * 24 * 60 * 60_000;

type DeviceRecord = {
  id: string;
  name: string;
  scope: WebUiDeviceScope;
  tokenHash: string;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
};

type PendingRecord = {
  id: string;
  name: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected';
  deliveryToken?: string;
  deliveryExpiresAt?: number;
};

export type WebUiDeviceView = Omit<DeviceRecord, 'tokenHash'>;

export type WebUiPendingPairingView = {
  id: string;
  name: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
};

export type WebUiAccessState = {
  code?: string;
  codeExpiresAt?: number;
  pending: WebUiPendingPairingView[];
  devices: WebUiDeviceView[];
};

export type PairingRequestResult =
  | { ok: true; requestId: string; expiresAt: number }
  | { ok: false; error: 'inactive' | 'invalid_code' | 'invalid_name'; attemptsLeft?: number };

export type PairingPollResult =
  | { status: 'pending' }
  | { status: 'approved'; token: string }
  | { status: 'rejected' }
  | { status: 'expired' };

export type WebUiAccessOptions = {
  storePath: string;
  auditPath?: string;
  now?: () => number;
  codeTtlMs?: number;
  pendingTtlMs?: number;
  deliveryTtlMs?: number;
};

const isDeviceRecord = (value: unknown): value is DeviceRecord => {
  if (!value || typeof value !== 'object') return false;
  const device = value as Record<string, unknown>;
  return (
    typeof device.id === 'string' &&
    typeof device.name === 'string' &&
    typeof device.tokenHash === 'string' &&
    /^[a-f0-9]{64}$/.test(device.tokenHash) &&
    (device.scope === 'read' || device.scope === 'control') &&
    typeof device.createdAt === 'number' &&
    typeof device.lastSeenAt === 'number' &&
    typeof device.expiresAt === 'number' &&
    typeof device.ip === 'string' &&
    typeof device.userAgent === 'string'
  );
};

/**
 * Pairing and device-token state for the WebUI service.
 *
 * The service never speaks to a phone without a device cookie. A phone proves
 * possession of the current one-time code, the desktop approves the request,
 * and only then does the phone receive an HttpOnly device token. Only the token
 * hash is written to disk; revoking a device invalidates its next request and
 * closes any WebSocket the web-host associated with it.
 */
export class WebUiAccessManager {
  private readonly storePath: string;
  private readonly auditPath: string;
  private readonly now: () => number;
  private readonly codeTtlMs: number;
  private readonly pendingTtlMs: number;
  private readonly deliveryTtlMs: number;
  private readonly devices = new Map<string, DeviceRecord>();
  private readonly pending = new Map<string, PendingRecord>();
  private readonly revokeListeners = new Set<(deviceId: string) => void>();
  private active = false;
  private code: string | null = null;
  private codeExpiresAt = 0;
  private attempts = 0;

  constructor(options: WebUiAccessOptions) {
    this.storePath = options.storePath;
    this.auditPath = options.auditPath ?? `${options.storePath}.audit.jsonl`;
    this.now = options.now ?? Date.now;
    this.codeTtlMs = options.codeTtlMs ?? DEFAULT_CODE_TTL_MS;
    this.pendingTtlMs = options.pendingTtlMs ?? DEFAULT_PENDING_TTL_MS;
    this.deliveryTtlMs = options.deliveryTtlMs ?? DEFAULT_DELIVERY_TTL_MS;
    this.load();
  }

  beginSession(): WebUiAccessState {
    this.active = true;
    this.pending.clear();
    this.rotateCode();
    return this.listState();
  }

  endSession(): void {
    this.active = false;
    this.code = null;
    this.codeExpiresAt = 0;
    this.attempts = 0;
    this.pending.clear();
  }

  rotateCode(): WebUiAccessState {
    if (!this.active) return this.listState();
    this.code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    this.codeExpiresAt = this.now() + this.codeTtlMs;
    this.attempts = 0;
    return this.listState();
  }

  getCode(): { code: string; expiresAt: number } | null {
    if (!this.active) return null;
    if (!this.code || this.now() >= this.codeExpiresAt) {
      this.rotateCode();
    }
    return this.code ? { code: this.code, expiresAt: this.codeExpiresAt } : null;
  }

  requestPairing(input: { code: string; name: string; ip: string; userAgent: string }): PairingRequestResult {
    const current = this.getCode();
    if (!current) return { ok: false, error: 'inactive' };

    const name = input.name.trim().slice(0, MAX_NAME_LENGTH) || 'Unknown device';
    if (!name) return { ok: false, error: 'invalid_name' };

    const offered = input.code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(offered) || !this.matchesCurrentCode(offered)) {
      this.attempts += 1;
      if (this.attempts >= MAX_ATTEMPTS) {
        this.rotateCode();
        this.audit('pair.locked', { ip: input.ip });
        return { ok: false, error: 'invalid_code', attemptsLeft: 0 };
      }
      this.audit('pair.invalid', { ip: input.ip, attemptsLeft: MAX_ATTEMPTS - this.attempts });
      return { ok: false, error: 'invalid_code', attemptsLeft: MAX_ATTEMPTS - this.attempts };
    }

    // A code is single-use: consuming it here prevents two phones racing one
    // displayed code. The desktop gets a fresh code on its next poll.
    this.rotateCode();
    const id = randomBytes(18).toString('base64url');
    const now = this.now();
    const record: PendingRecord = {
      id,
      name,
      ip: input.ip,
      userAgent: input.userAgent.slice(0, 256),
      createdAt: now,
      expiresAt: now + this.pendingTtlMs,
      status: 'pending',
    };
    this.pending.set(id, record);
    this.audit('pair.request', { requestId: id, name, ip: input.ip });
    return { ok: true, requestId: id, expiresAt: record.expiresAt };
  }

  poll(requestId: string): PairingPollResult {
    const record = this.pending.get(requestId);
    if (!record) return { status: 'expired' };
    if (record.status === 'pending' && this.now() >= record.expiresAt) {
      this.pending.delete(requestId);
      this.audit('pair.expired', { requestId });
      return { status: 'expired' };
    }
    if (record.status === 'rejected') {
      this.pending.delete(requestId);
      return { status: 'rejected' };
    }
    if (record.status === 'approved') {
      const token = record.deliveryToken;
      const expiresAt = record.deliveryExpiresAt ?? 0;
      if (!token || this.now() >= expiresAt) {
        this.pending.delete(requestId);
        this.audit('pair.delivery_expired', { requestId });
        return { status: 'expired' };
      }
      record.deliveryToken = undefined;
      record.deliveryExpiresAt = undefined;
      this.pending.delete(requestId);
      return { status: 'approved', token };
    }
    return { status: 'pending' };
  }

  approve(
    requestId: string,
    scope: WebUiDeviceScope = 'read'
  ): { ok: true } | { ok: false; error: string } {
    const record = this.pending.get(requestId);
    if (!record || record.status !== 'pending') return { ok: false, error: 'request_not_found' };
    if (this.now() >= record.expiresAt) {
      this.pending.delete(requestId);
      return { ok: false, error: 'request_expired' };
    }

    const id = randomBytes(9).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    const token = `${id}.${secret}`;
    const now = this.now();
    this.devices.set(id, {
      id,
      name: record.name,
      scope,
      tokenHash: hashToken(token),
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + DEVICE_LIFETIME_MS,
      ip: record.ip,
      userAgent: record.userAgent,
    });
    record.status = 'approved';
    record.deliveryToken = token;
    record.deliveryExpiresAt = now + this.deliveryTtlMs;
    this.persist();
    this.audit('pair.approved', { requestId, deviceId: id, name: record.name, scope, ip: record.ip });
    return { ok: true };
  }

  reject(requestId: string): { ok: boolean } {
    const record = this.pending.get(requestId);
    if (!record || record.status !== 'pending') return { ok: false };
    record.status = 'rejected';
    record.deliveryToken = undefined;
    this.audit('pair.rejected', { requestId, name: record.name, ip: record.ip });
    return { ok: true };
  }

  revoke(deviceId: string): { ok: boolean } {
    const device = this.devices.get(deviceId);
    if (!device) return { ok: false };
    this.devices.delete(deviceId);
    this.persist();
    this.audit('device.revoked', { deviceId, name: device.name });
    for (const listener of this.revokeListeners) listener(deviceId);
    return { ok: true };
  }

  verifyCookie(cookieHeader: string | undefined): { deviceId: string; scope: WebUiDeviceScope } | null {
    const token = readCookie(cookieHeader, WEBUI_DEVICE_COOKIE);
    if (!token) return null;
    const separator = token.indexOf('.');
    if (separator <= 0 || separator === token.length - 1) return null;
    const deviceId = token.slice(0, separator);
    const device = this.devices.get(deviceId);
    if (!device) return null;
    if (this.now() >= device.expiresAt) {
      this.devices.delete(deviceId);
      this.persist();
      this.audit('device.expired', { deviceId, name: device.name });
      return null;
    }
    const expected = Buffer.from(device.tokenHash, 'hex');
    const actual = createHash('sha256').update(token).digest();
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    device.lastSeenAt = this.now();
    this.schedulePersist();
    return { deviceId, scope: device.scope };
  }

  onRevoke(listener: (deviceId: string) => void): () => void {
    this.revokeListeners.add(listener);
    return () => this.revokeListeners.delete(listener);
  }

  listState(): WebUiAccessState {
    const current = this.getCode();
    const now = this.now();
    const pending: WebUiPendingPairingView[] = [];
    for (const [id, record] of this.pending) {
      if (record.status !== 'pending') continue;
      if (now >= record.expiresAt) {
        this.pending.delete(id);
        continue;
      }
      pending.push({
        id,
        name: record.name,
        ip: record.ip,
        userAgent: record.userAgent,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      });
    }
    return {
      ...(current ? { code: current.code, codeExpiresAt: current.expiresAt } : {}),
      pending: pending.toSorted((a, b) => a.createdAt - b.createdAt),
      devices: [...this.devices.values()]
        .map(({ tokenHash: _tokenHash, ...device }) => device)
        .toSorted((a, b) => a.createdAt - b.createdAt),
    };
  }

  private matchesCurrentCode(offered: string): boolean {
    if (!this.code || offered.length !== this.code.length) return false;
    return timingSafeEqual(Buffer.from(offered), Buffer.from(this.code));
  }

  private schedulePersist(): void {
    // lastSeenAt is a display detail; avoid a disk write on every API request.
    const now = this.now();
    if (now - this.lastPersistedAt < 60_000) return;
    this.lastPersistedAt = now;
    this.persist();
  }

  private lastPersistedAt = 0;

  private load(): void {
    try {
      const raw = readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as { devices?: unknown[] };
      if (!Array.isArray(parsed.devices)) return;
      for (const candidate of parsed.devices) {
        if (isDeviceRecord(candidate)) this.devices.set(candidate.id, candidate);
      }
    } catch {
      // A missing or malformed store means "no paired devices", not a failed start.
    }
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.storePath), { recursive: true });
      writeFileSync(
        this.storePath,
        JSON.stringify({ version: 1, devices: [...this.devices.values()] }, null, 2),
        { encoding: 'utf8', mode: 0o600 }
      );
    } catch (error) {
      this.audit('store.write_failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    try {
      mkdirSync(dirname(this.auditPath), { recursive: true });
      appendFileSync(
        this.auditPath,
        `${JSON.stringify({ at: new Date(this.now()).toISOString(), event, ...detail })}\n`,
        'utf8'
      );
    } catch {
      // Audit is best-effort; a full disk must not take pairing down.
    }
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}
