import { test, expect } from '../fixtures';
import { invokeBridge } from '../helpers';

type WebUiStatus = {
  success?: boolean;
  data?: { running?: boolean; port?: number; url?: string; error?: string };
  msg?: string;
};

/**
 * The settings switch is the only user-facing way to start the WebUI. This test
 * goes through that switch and then checks the real listener, not just the
 * bridge state: a "running" status with no HTTP server behind it would still
 * leave a phone with nothing to open.
 */
test('starts and stops the WebUI from the system settings switch', async ({ page }) => {
  test.setTimeout(90_000);

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

  try {
    await toggle.click();
    await expect(toggle).toHaveAttribute('data-state', 'checked', { timeout: 15_000 });

    const started = (await invokeBridge(page, 'webui.get-status')) as WebUiStatus;
    expect(started.success).toBe(true);
    expect(started.data?.running).toBe(true);
    expect(started.data?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const response = await fetch(`${started.data?.url}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<!doctype html');
  } finally {
    if ((await toggle.getAttribute('data-state').catch(() => null)) === 'checked') {
      await toggle.click();
    }
  }

  await expect(toggle).toHaveAttribute('data-state', 'unchecked', { timeout: 15_000 });
  const stopped = (await invokeBridge(page, 'webui.get-status')) as WebUiStatus;
  expect(stopped.data?.running).toBe(false);
});
