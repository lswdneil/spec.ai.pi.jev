import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '../fixtures';
import { invokeBridge } from '../helpers';

test.use({ channel: 'chrome' });

type WebUiStatus = {
  success?: boolean;
  data?: { running?: boolean; port?: number; url?: string; error?: string };
  msg?: string;
};

type WebUiAccess = {
  data?: { code?: string };
};

/**
 * The settings switch is the only user-facing way to start the WebUI. This test
 * goes through that switch, pairs a real browser with the one-time code,
 * approves it on the desktop, and then revokes it. A "running" status with no
 * listener, an unpaired browser, or a revocation that does not invalidate the
 * cookie would all fail here.
 */
test('pairs, approves, and revokes a WebUI device', async ({ page, browser, electronApp }, testInfo) => {
  test.setTimeout(120_000);

  const welcome = page.getByTestId('mu-welcome');
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.locator('footer button').first().click();
    await expect(welcome).toBeHidden({ timeout: 15_000 });
  }

  await page.evaluate(() => {
    window.location.hash = '/settings/system';
  });
  const toggle = page.getByTestId('webui-toggle');
  await expect(toggle).toBeVisible({ timeout: 15_000 });

  const current = (await invokeBridge(page, 'webui.get-status')) as WebUiStatus;
  if (current?.data?.running) {
    await invokeBridge(page, 'webui.stop');
    await expect(toggle).toHaveAttribute('data-state', 'unchecked', { timeout: 10_000 });
  }

  // The E2E user-data folder can survive a rerun. Revoke leftovers so the
  // device row this test clicks is the one it just paired.
  const existing = (await invokeBridge(page, 'webui.get-access')) as {
    data?: { devices?: Array<{ id: string }> };
  };
  for (const device of existing.data?.devices ?? []) {
    await invokeBridge(page, 'webui.revoke-device', { id: device.id });
  }

  const phoneContext = await browser.newContext({ serviceWorkers: 'block' });
  const phone = await phoneContext.newPage();

  try {
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-state', 'checked', { timeout: 15_000 });

    const started = (await invokeBridge(page, 'webui.get-status')) as WebUiStatus;
    expect(started.success).toBe(true);
    expect(started.data?.running).toBe(true);
    expect(started.data?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    const baseUrl = started.data?.url ?? '';

    const preference = async (): Promise<boolean | undefined> => {
      const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'));
      const raw = readFileSync(join(userData, 'config', 'aionui-config.txt'), 'utf8');
      const data = JSON.parse(decodeURIComponent(Buffer.from(raw, 'base64').toString())) as {
        'system.webuiEnabled'?: boolean;
      };
      return data['system.webuiEnabled'];
    };
    expect(await preference(), 'Remote access is persisted on start').toBe(true);

    const access = (await invokeBridge(page, 'webui.get-access')) as WebUiAccess;
    const code = access.data?.code ?? '';
    expect(code).toMatch(/^\d{6}$/);
    await page.screenshot({ path: testInfo.outputPath('remote-access-panel.png') });

    await phone.goto(`${baseUrl}/`);
    await expect(phone).toHaveURL(/\/pair$/);
    await phone.screenshot({ path: testInfo.outputPath('pair-page.png') });
    await phone.locator('#code').fill(code);
    await phone.locator('#name').fill('E2E phone');
    await phone.locator('#submit').click();
    await expect(phone.locator('#pair-form')).toBeHidden({ timeout: 15_000 });

    await expect(page.getByTestId('pending-pairing-approve')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: testInfo.outputPath('remote-access-pending.png') });
    await page.getByTestId('pending-pairing-approve').click();
    await expect(phone).not.toHaveURL(/\/pair$/, { timeout: 20_000 });
    expect(phone.url().startsWith(baseUrl)).toBe(true);

    const paired = await phone.evaluate(async () => (await fetch('/api/pair/status')).json());
    expect(paired).toEqual({ paired: true });

    // New devices default to read-only. Reading is allowed; a write is refused
    // before it reaches AionCore.
    const readOnly = await phone.evaluate(async () => {
      const read = await fetch('/api/settings');
      const write = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      return { read: read.status, write: write.status, body: await write.json() };
    });
    expect(readOnly).toEqual({ read: 200, write: 403, body: { error: 'READ_ONLY_DEVICE' } });

    const kyrn = await phone.evaluate(
      () =>
        new Promise<{ ok?: boolean; error?: string }>((resolve) => {
          const socket = new WebSocket(`ws://${window.location.host}/kyrn`);
          const timer = window.setTimeout(() => {
            socket.close();
            resolve({ error: 'timeout' });
          }, 15_000);
          socket.addEventListener('open', () =>
            socket.send(JSON.stringify({ id: 'pair-e2e', name: 'kyrn.settings', data: null }))
          );
          socket.addEventListener('message', (event) => {
            const frame = JSON.parse(event.data as string) as {
              id?: string;
              result?: { ok?: boolean };
              error?: string;
            };
            if (frame.id !== 'pair-e2e') return;
            window.clearTimeout(timer);
            socket.close();
            resolve(frame.error ? { error: frame.error } : (frame.result ?? { error: 'empty result' }));
          });
          socket.addEventListener('error', () => {
            window.clearTimeout(timer);
            resolve({ error: 'websocket error' });
          });
        })
    );
    expect(kyrn, 'approved device reaches the KyRN host').toMatchObject({ ok: true });

    const denied = await phone.evaluate(
      () =>
        new Promise<{ error?: string; code?: string }>((resolve) => {
          const socket = new WebSocket(`ws://${window.location.host}/kyrn`);
          const timer = window.setTimeout(() => {
            socket.close();
            resolve({ error: 'timeout' });
          }, 15_000);
          socket.addEventListener('open', () =>
            socket.send(JSON.stringify({ id: 'pair-e2e-write', name: 'kyrn.save', data: null }))
          );
          socket.addEventListener('message', (event) => {
            const frame = JSON.parse(event.data as string) as { id?: string; error?: string; code?: string };
            if (frame.id !== 'pair-e2e-write') return;
            window.clearTimeout(timer);
            socket.close();
            resolve({ error: frame.error, code: frame.code });
          });
          socket.addEventListener('error', () => {
            window.clearTimeout(timer);
            resolve({ error: 'websocket error' });
          });
        })
    );
    expect(denied).toMatchObject({ code: 'permissionDenied' });

    await expect(page.getByTestId('device-revoke')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('device-revoke').click();
    await expect(page.getByTestId('device-revoke')).toBeHidden({ timeout: 15_000 });

    // Any in-flight API request on the now-revoked page gets PAIRING_REQUIRED
    // and the WebUI moves itself to /pair. If it was idle, navigating does the
    // same server-side redirect.
    await expect(phone)
      .toHaveURL(/\/pair$/, { timeout: 15_000 })
      .catch(async () => {
        await phone.goto(`${baseUrl}/?revoked=1`);
        await expect(phone).toHaveURL(/\/pair$/);
      });
    const unpaired = await phone.evaluate(async () => (await fetch('/api/pair/status')).json());
    expect(unpaired).toEqual({ paired: false });
  } finally {
    const state = await toggle.getAttribute('data-state').catch(() => null);
    if (state === 'checked') await toggle.click();
    else await invokeBridge(page, 'webui.stop');
    await phoneContext.close();
  }

  await expect(toggle).toHaveAttribute('data-state', 'unchecked', { timeout: 15_000 });
  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'));
  const raw = readFileSync(join(userData, 'config', 'aionui-config.txt'), 'utf8');
  const data = JSON.parse(decodeURIComponent(Buffer.from(raw, 'base64').toString())) as {
    'system.webuiEnabled'?: boolean;
  };
  expect(data['system.webuiEnabled'], 'Remote access is persisted off').toBe(false);
});
