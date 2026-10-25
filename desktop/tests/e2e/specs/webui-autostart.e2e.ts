import { _electron as electron } from 'playwright';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const desktopRoot = process.cwd();
const backendBinary =
  process.env.MU_BACKEND_BIN ?? join(desktopRoot, 'resources', 'bundled-aioncore', 'win32-x64', 'aioncore.exe');

/**
 * `system.webuiEnabled` is written when the switch is turned on. This launches a
 * fresh app with that preference already in its sandbox config and asserts the
 * service is running by the time Settings paints, without the user touching the
 * switch.
 */
test('starts the WebUI on launch when the persisted switch is on', async () => {
  test.skip(true, 'Remote access is deferred for 0.1.x; the code and this test stay for the later release.');
  test.setTimeout(120_000);
  if (!existsSync(backendBinary)) test.skip(true, 'bundled backend is missing');

  const userData = mkdtempSync(join(tmpdir(), 'sv-webui-autostart-'));
  const configDir = join(userData, 'config');
  mkdirSync(configDir, { recursive: true });
  const encoded = Buffer.from(
    encodeURIComponent(JSON.stringify({ 'system.webuiEnabled': true })),
    'utf8'
  ).toString('base64');
  writeFileSync(join(configDir, 'aionui-config.txt'), encoded, 'utf8');

  const app = await electron.launch({
    args: ['.'],
    cwd: desktopRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      MU_E2E_TEST: '1',
      MU_E2E_USER_DATA_DIR: userData,
      MU_BACKEND_BIN: backendBinary,
      MU_EXTENSIONS_PATH: process.env.MU_EXTENSIONS_PATH ?? join(desktopRoot, 'examples'),
      MU_DISABLE_AUTO_UPDATE: '1',
      MU_DISABLE_DEVTOOLS: '1',
      MU_CDP_PORT: String(9300 + Math.floor(Math.random() * 500)),
    },
    timeout: 60_000,
  });

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      localStorage.setItem('mu.onboarding.v1', new Date().toISOString());
      window.location.hash = '/settings/system';
    });
    const toggle = page.getByTestId('webui-toggle');
    await expect(toggle).toBeVisible({ timeout: 60_000 });
    await expect(toggle).toHaveAttribute('data-state', 'checked', { timeout: 30_000 });
  } finally {
    await app.close();
    rmSync(userData, { recursive: true, force: true });
  }
});
