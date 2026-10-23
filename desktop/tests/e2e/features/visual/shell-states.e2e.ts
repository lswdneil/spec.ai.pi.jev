/**
 * Shell visual states: the shapes that are easy to break when chrome moves.
 *
 * Screenshots are written next to the test output for review, while the test
 * asserts the state that matters: the judge dot keeps its pink accent, the
 * sidebar folds and unfolds, and the narrow desktop does not scroll sideways.
 */
import { expect, test } from '../../fixtures';

test.describe('Shell visual states', () => {
  test('keeps the judge accent, sidebar states and narrow desktop intact', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1280, height: 800 });

    const welcome = page.getByTestId('mu-welcome');
    const onboardingSeen = await page.evaluate(() => Boolean(localStorage.getItem('mu.onboarding.v1')));
    if (!onboardingSeen) {
      await expect(welcome).toBeVisible({ timeout: 60_000 });
      await welcome.locator('footer button').first().click();
      await expect(welcome).toBeHidden({ timeout: 15_000 });
    }

    await page.evaluate(() => {
      window.location.hash = '/guid';
    });
    await expect(page.locator('.sv-icon-sider').first()).toBeVisible({ timeout: 15_000 });

    const capture = async (name: string) => {
      await page.mouse.move(1100, 700);
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: testInfo.outputPath(name) });
    };

    const setTheme = async (theme: 'dark' | 'light') => {
      const current = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (current !== theme) {
        await page.evaluate(() => {
          (document.querySelector('.app-titlebar__button') as HTMLElement | null)?.click();
        });
      }
      await page.waitForFunction(
        (expected) => document.documentElement.getAttribute('data-theme') === expected,
        theme,
        { timeout: 5_000 }
      );
      // The judge dot transitions its background over 160ms; read the settled colour.
      await page.waitForTimeout(250);
    };

    await setTheme('dark');

    const accent = await page.evaluate(() => {
      const dot = document.querySelector('[data-testid="mu-judge-pulse"] span');
      const probe = document.createElement('span');
      probe.style.background = 'var(--sv-jev-pink)';
      document.body.appendChild(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return {
        dot: dot ? getComputedStyle(dot).backgroundColor : null,
        expected,
        violet: getComputedStyle(document.documentElement).getPropertyValue('--sv-jev-violet').trim(),
      };
    });

    expect(accent.dot, 'judge dot keeps the pink accent').toBe(accent.expected);
    expect(accent.violet, 'violet remains a defined Jev token').not.toBe('');

    await capture('home-dark.png');

    await page.getByTestId('sider-search').first().click();
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await capture('command-palette-dark.png');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette')).toBeHidden();

    const sider = page.locator('.arco-layout-sider').first();
    await page.getByTestId('sider-collapse').click();
    await expect(sider).toHaveClass(/arco-layout-sider-collapsed/);
    await capture('home-collapsed-dark.png');

    await page.getByTestId('sider-collapse').click();
    await expect(sider).not.toHaveClass(/arco-layout-sider-collapsed/);

    await page.getByTestId('sider-settings').first().click();
    await expect(page.locator('[data-settings-path="appearance"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-settings-path="appearance"]').click();
    await expect(page.getByTestId('appearance-v2')).toBeVisible({ timeout: 15_000 });
    await capture('settings-dark.png');

    await setTheme('light');
    await capture('settings-light.png');

    await page.evaluate(() => {
      window.location.hash = '/guid';
    });
    await expect(page.locator('.sv-icon-sider').first()).toBeVisible({ timeout: 15_000 });

    const checkWidth = async (width: 900 | 780) => {
      await page.setViewportSize({ width, height: 800 });
      await capture(`home-${width}.png`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${width}px: horizontal overflow`).toBeLessThanOrEqual(1);
    };

    await checkWidth(900);
    await checkWidth(780);
  });
});
