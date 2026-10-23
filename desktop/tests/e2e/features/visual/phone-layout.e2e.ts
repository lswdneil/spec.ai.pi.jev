/**
 * 390px phone shell in a real browser.
 *
 * Electron's desktop window always reports itself as desktop, so the phone
 * layout cannot be reached by resizing it. This test serves the built renderer
 * through web-host and opens it in Chrome with a phone viewport and touch.
 * It uses the real read-only WebUI catalog provider, so no bridge call is
 * stubbed.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../../fixtures';

test.use({ channel: 'chrome' });

const desktopRoot = process.cwd();
const rendererDir = join(desktopRoot, 'out', 'renderer');
const bunBinary = (): string => {
  if (process.env.BUN_BIN) return process.env.BUN_BIN;
  const npmBun = join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'bun', 'bin', 'bun.exe');
  return existsSync(npmBun) ? npmBun : 'bun';
};

function startWebHost(backendPort: number): Promise<{ url: string; stop: () => void }> {
  const script = [
    "import { startStaticServer } from './packages/web-host/src/static-server.ts';",
    'const server = await startStaticServer({',
    '  staticDir: process.env.RENDERER_DIR,',
    '  backendPort: Number(process.env.BACKEND_PORT),',
    '  port: 0,',
    '});',
    "console.log('WEBURL=' + server.localUrl);",
    "process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });",
    'await new Promise(() => {});',
  ].join('\n');

  return new Promise((resolve, reject) => {
    const child = spawn(bunBinary(), ['-e', script], {
      cwd: desktopRoot,
      env: {
        ...process.env,
        RENDERER_DIR: rendererDir,
        BACKEND_PORT: String(backendPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let error = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      const match = output.match(/WEBURL=(\S+)/);
      if (match) resolve({ url: match[1], stop: () => child.kill() });
    });
    child.stderr.on('data', (chunk: string) => {
      error += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!output.includes('WEBURL=')) reject(new Error(`web-host exited (${code}): ${error}`));
    });
  });
}

test('renders the phone shell at 390px', async ({ page: electronPage, browser }, testInfo) => {
  test.setTimeout(120_000);

  const backendPort = await electronPage.evaluate(
    () => (window as unknown as { __backendPort?: number }).__backendPort ?? 0
  );
  if (!backendPort) test.skip(true, 'The Electron app did not expose a backend port');

  const server = await startWebHost(backendPort);

  try {
    const webPage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });

    await webPage.addInitScript(() => {
      try {
        localStorage.setItem('mu.onboarding.v1', new Date().toISOString());
      } catch {
        // A browser without storage still paints the shell.
      }
    });

    await webPage.goto(`${server.url}/#/guid`, { waitUntil: 'domcontentloaded' });
    await expect(webPage.locator('html')).toHaveAttribute('data-phone-layout', '', { timeout: 30_000 });
    await expect(webPage.getByTestId('mobile-tab-bar')).toBeVisible();
    await expect(webPage.getByTestId('tab-new')).toBeVisible();
    await expect(webPage.getByTestId('mu-hero')).toBeVisible({ timeout: 30_000 });

    const overflow = await webPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, '390px: horizontal overflow').toBeLessThanOrEqual(1);

    await webPage.screenshot({ path: testInfo.outputPath('phone-390-guid.png') });

    await webPage.evaluate(() => {
      (document.querySelector('.app-titlebar__button') as HTMLElement | null)?.click();
    });
    await webPage.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', undefined, {
      timeout: 5_000,
    });
    await webPage.waitForTimeout(250);
    await webPage.screenshot({ path: testInfo.outputPath('phone-390-dark.png') });

    await webPage.evaluate(() => {
      (document.querySelector('.app-titlebar__button') as HTMLElement | null)?.click();
    });
    await webPage.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light', undefined, {
      timeout: 5_000,
    });

    await webPage.getByTestId('tab-sessions').click();
    await expect(webPage.getByTestId('sider-search')).toBeVisible({ timeout: 15_000 });
    await webPage.screenshot({ path: testInfo.outputPath('phone-390-sessions.png') });
    await webPage.locator('.layout-sider-header button').click();
    await expect(webPage.locator('.arco-layout-sider')).toHaveClass(/arco-layout-sider-collapsed/, {
      timeout: 15_000,
    });

    await webPage.getByTestId('tab-search').click();
    await expect(webPage.getByTestId('command-palette')).toBeVisible({ timeout: 15_000 });
    await webPage.screenshot({ path: testInfo.outputPath('phone-390-palette.png') });
    await webPage.keyboard.press('Escape');
    await expect(webPage.getByTestId('command-palette')).toBeHidden();

    await webPage.getByTestId('tab-settings').click();
    await webPage.waitForFunction(() => window.location.hash.includes('/settings'), undefined, { timeout: 15_000 });
    await expect(webPage.getByTestId('mobile-tab-bar')).toBeVisible();
    await webPage.locator('.settings-mobile-top-nav__item').first().click();
    await expect(webPage.getByTestId('appearance-v2')).toBeVisible({ timeout: 30_000 });
    await webPage.screenshot({ path: testInfo.outputPath('phone-390-settings.png') });

    const assistantId = await webPage.evaluate(async () => {
      const response = await fetch('/api/assistants');
      if (!response.ok) return null;
      const json = (await response.json()) as unknown;
      const rows =
        Array.isArray(json) ? json : ((json as { data?: unknown }).data as unknown[] | undefined);
      if (!Array.isArray(rows)) return null;
      const assistants = rows as Array<{
        id?: string;
        enabled?: boolean;
        agent?: { type?: string; acp_backend?: string };
      }>;
      return (
        assistants.find((row) => row.enabled && (row.agent?.acp_backend || row.agent?.type === 'acp'))?.id ??
        assistants.find((row) => row.enabled)?.id ??
        null
      );
    });
    if (assistantId) {
      const conversationId = await webPage.evaluate(async (id) => {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `e2e-phone-${Date.now()}`,
            name: 'E2E Phone Conversation',
            assistant: { id },
            extra: { workspace: '/tmp', custom_workspace: true, session_mode: 'default' },
          }),
        });
        if (!response.ok) throw new Error(`POST /api/conversations failed (${response.status})`);
        const json = (await response.json()) as { data?: { id?: string } };
        if (!json.data?.id) throw new Error('POST /api/conversations did not return an id');
        return json.data.id;
      }, assistantId);

      await webPage.goto(`${server.url}/#/conversation/${conversationId}`);
      await webPage.waitForFunction(
        (id) => window.location.hash.includes(`/conversation/${id}`),
        conversationId,
        { timeout: 15_000 }
      );
      await expect(webPage.getByTestId('mobile-tab-bar')).toBeVisible({ timeout: 15_000 });
      await webPage.waitForTimeout(1_000);
      await webPage.screenshot({ path: testInfo.outputPath('phone-390-conversation.png') });
    }
  } finally {
    server.stop();
  }
});
