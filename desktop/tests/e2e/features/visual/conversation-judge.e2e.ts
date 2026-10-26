/**
 * A real conversation page with a file-change tool card, then the Jev judge
 * panel's focus and context states. The synthetic stream injector is the same
 * one the message-list E2E uses; no provider request is made.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures';
import { findAssistantIdForBackend, goToGuid } from '../../helpers';

const STREAM_KEY = 'mu:e2e-message-stream-conversation-id';

type StreamController = {
  emitFileChange: (path: string, oldText: string, newText: string) => Promise<void>;
  emitToolError: (toolName: string, description: string) => Promise<void>;
};

async function skipWelcome(page: Page): Promise<void> {
  const welcome = page.getByTestId('mu-welcome');
  const seen = await page.evaluate(() => Boolean(localStorage.getItem('mu.onboarding.v1')));
  if (seen) return;
  await expect(welcome).toBeVisible({ timeout: 60_000 });
  await welcome.locator('footer button').first().click();
  await expect(welcome).toBeHidden({ timeout: 15_000 });
}

async function createConversation(page: Page, assistantId: string): Promise<string> {
  const id = `e2e-visual-${Date.now()}`;
  return page.evaluate(
    async ({ conversation }) => {
      const port = (window as unknown as { __backendPort?: number }).__backendPort;
      if (!port) throw new Error('window.__backendPort is not available');
      const response = await fetch(`http://127.0.0.1:${port}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation),
      });
      if (!response.ok) throw new Error(`POST /api/conversations failed (${response.status})`);
      const json = (await response.json()) as { data?: { id?: string } };
      if (!json.data?.id) throw new Error('POST /api/conversations did not return an id');
      return json.data.id;
    },
    {
      conversation: {
        id,
        name: `E2E Visual ${id}`,
        assistant: { id: assistantId },
        extra: { workspace: '/tmp', custom_workspace: true, session_mode: 'default' },
      },
    }
  );
}

async function capture(page: Page, path: string): Promise<void> {
  await page.mouse.move(1100, 700);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
}

test.describe('Conversation and judge visuals', () => {
  test('shows a tool card and the judge panel focus and context states', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1280, height: 800 });
    await skipWelcome(page);
    await goToGuid(page);

    const assistantId =
      (await findAssistantIdForBackend(page, 'claude', { requireAvailable: true })) ??
      (await findAssistantIdForBackend(page, 'acp', { requireAvailable: true }));
    test.skip(!assistantId, 'No available ACP assistant for the visual conversation');
    if (!assistantId) return;

    const conversationId = await createConversation(page, assistantId);
    await page.evaluate(({ id, key }) => sessionStorage.setItem(key, id), { id: conversationId, key: STREAM_KEY });

    const base = page.url().split('#')[0];
    await page.goto(`${base}#/conversation/${conversationId}`);
    await page.waitForFunction(
      (id) =>
        Boolean(
          (window as unknown as { __MU_E2E_MESSAGE_STREAM__?: { controllers: Record<string, unknown> } })
            .__MU_E2E_MESSAGE_STREAM__?.controllers[id]
        ),
      conversationId,
      { timeout: 15_000 }
    );

    await page.evaluate(
      async ({ id }) => {
        const controller = (
          window as unknown as {
            __MU_E2E_MESSAGE_STREAM__?: { controllers: Record<string, StreamController> };
          }
        ).__MU_E2E_MESSAGE_STREAM__?.controllers[id];
        if (!controller) throw new Error(`No stream controller for ${id}`);
        await controller.emitFileChange(
          'src/judge-scale.ts',
          'export const before = 1;\n',
          'export const before = 2;\n'
        );
        await controller.emitToolError('bash', 'Command failed: npm test');
      },
      { id: conversationId }
    );

    await page.waitForSelector('[data-testid="message-list-scroller"]', { timeout: 15_000 });
    await expect(page.getByText('judge-scale.ts').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('bash').first()).toBeVisible({ timeout: 15_000 });
    await capture(page, testInfo.outputPath('conversation-tool-cards-dark.png'));

    if (
      !(await page
        .getByTestId('work-panel')
        .isVisible()
        .catch(() => false))
    ) {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('mu-workspace-toggle')));
    }
    await expect(page.getByTestId('work-panel')).toBeVisible({ timeout: 15_000 });
    await page.locator('#mu-work-panel-tab-judge').click();
    await expect(page.getByTestId('kyrn-judge')).toBeVisible({ timeout: 15_000 });

    const contextToggle = page.getByTestId('judge-context-toggle');
    await contextToggle.focus();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('judge-context-toggle');
    await capture(page, testInfo.outputPath('judge-focus-dark.png'));

    await contextToggle.click();
    await expect(contextToggle).toHaveAttribute('aria-expanded', 'true');
    await capture(page, testInfo.outputPath('judge-context-dark.png'));
  });
});
