import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WebUiAccessManager, WEBUI_DEVICE_COOKIE } from '@process/services/webui/access';

const dirs: string[] = [];

function makeManager(options: { now?: () => number } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'specjev-webui-'));
  dirs.push(dir);
  const storePath = join(dir, 'devices.json');
  return {
    manager: new WebUiAccessManager({ storePath, now: options.now }),
    storePath,
  };
}

function pair(manager: WebUiAccessManager): { requestId: string; code: string; token: string } {
  const state = manager.beginSession();
  const code = state.code ?? '';
  const request = manager.requestPairing({ code, name: 'Phone', ip: '127.0.0.1', userAgent: 'test' });
  if (!request.ok) throw new Error(`pairing request failed: ${request.error}`);
  expect(manager.approve(request.requestId)).toEqual({ ok: true });
  const polled = manager.poll(request.requestId);
  if (polled.status !== 'approved') throw new Error(`pairing not approved: ${polled.status}`);
  return { requestId: request.requestId, code, token: polled.token };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('WebUiAccessManager', () => {
  it('consumes a valid code once and delivers a token after approval', () => {
    const { manager, storePath } = makeManager();
    const state = manager.beginSession();
    expect(state.code).toMatch(/^\d{6}$/);
    const code = state.code ?? '';

    const request = manager.requestPairing({ code, name: 'My phone', ip: '10.0.0.2', userAgent: 'UA' });
    expect(request.ok).toBe(true);
    if (!request.ok) return;

    // The code is single-use; the desktop gets a fresh one for the next phone.
    const second = manager.requestPairing({ code, name: 'Other phone', ip: '10.0.0.3', userAgent: 'UA' });
    expect(second.ok).toBe(false);

    const pending = manager.listState().pending;
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe('My phone');

    expect(manager.approve(request.requestId)).toEqual({ ok: true });
    const polled = manager.poll(request.requestId);
    expect(polled.status).toBe('approved');
    if (polled.status !== 'approved') return;

    expect(manager.verifyCookie(`${WEBUI_DEVICE_COOKIE}=${encodeURIComponent(polled.token)}`)).toEqual({
      deviceId: polled.token.split('.')[0],
    });
    expect(manager.poll(request.requestId).status).toBe('expired');
    expect(manager.listState().devices).toHaveLength(1);

    const stored = readFileSync(storePath, 'utf8');
    expect(stored).toContain(polled.token.split('.')[0]);
    expect(stored).not.toContain(polled.token.split('.')[1]);
  });

  it('locks the code after five wrong attempts', () => {
    const { manager } = makeManager();
    manager.beginSession();
    let last: ReturnType<WebUiAccessManager['requestPairing']> | null = null;
    for (let i = 0; i < 5; i += 1) {
      last = manager.requestPairing({ code: '000000', name: 'Phone', ip: '127.0.0.1', userAgent: 'UA' });
    }
    expect(last?.ok).toBe(false);
    if (last?.ok === false) expect(last.attemptsLeft).toBe(0);
    expect(manager.listState().code).toMatch(/^\d{6}$/);
  });

  it('revokes a device, rejects its cookie, and notifies socket owners', () => {
    const { manager } = makeManager();
    const { token } = pair(manager);
    const deviceId = token.split('.')[0];
    const revoked: string[] = [];
    manager.onRevoke((id) => revoked.push(id));

    expect(manager.verifyCookie(`${WEBUI_DEVICE_COOKIE}=${encodeURIComponent(token)}`)).not.toBeNull();
    expect(manager.revoke(deviceId)).toEqual({ ok: true });
    expect(manager.verifyCookie(`${WEBUI_DEVICE_COOKIE}=${encodeURIComponent(token)}`)).toBeNull();
    expect(revoked).toEqual([deviceId]);
  });

  it('persists paired devices across manager instances', () => {
    const { manager, storePath } = makeManager();
    const { token } = pair(manager);
    const reloaded = new WebUiAccessManager({ storePath });
    expect(reloaded.verifyCookie(`${WEBUI_DEVICE_COOKIE}=${token}`)).toEqual({ deviceId: token.split('.')[0] });
  });

  it('expires a pending request and a pairing code', () => {
    let now = 1_000;
    const { manager } = makeManager({ now: () => now });
    const state = manager.beginSession();
    const code = state.code ?? '';
    const request = manager.requestPairing({ code, name: 'Phone', ip: '127.0.0.1', userAgent: 'UA' });
    expect(request.ok).toBe(true);
    if (!request.ok) return;

    now += 5 * 60_000 + 1;
    expect(manager.poll(request.requestId).status).toBe('expired');
    const late = manager.requestPairing({ code, name: 'Phone', ip: '127.0.0.1', userAgent: 'UA' });
    expect(late.ok).toBe(false);
  });

  it('expires a device token after its lifetime', () => {
    let now = 1_000;
    const { manager } = makeManager({ now: () => now });
    const { token } = pair(manager);
    expect(manager.verifyCookie(`${WEBUI_DEVICE_COOKIE}=${token}`)).not.toBeNull();
    now += 31 * 24 * 60 * 60_000;
    expect(manager.verifyCookie(`${WEBUI_DEVICE_COOKIE}=${token}`)).toBeNull();
  });

  it('ignores malformed and unknown device cookies', () => {
    const { manager } = makeManager();
    expect(manager.verifyCookie(undefined)).toBeNull();
    expect(manager.verifyCookie(`${WEBUI_DEVICE_COOKIE}=not-a-token`)).toBeNull();
    expect(manager.verifyCookie(`${WEBUI_DEVICE_COOKIE}=missing.secret`)).toBeNull();
  });
});
