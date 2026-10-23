/**
 * Icon scale: the class that names a size is the size the renderer paints.
 *
 * The unit guard proves no file writes a literal icon size. This test proves
 * the shared classes survive the app's CSS cascade and paint at their tokens,
 * including icon-park wrappers, in both themes.
 */
import { expect, test } from '../../fixtures';

const scale = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  sider: 18,
  titlebar: 18,
} as const;

test.describe('Icon scale', () => {
  test('paints every visible scale class at its token size in both themes', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('mu-welcome')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('mu-welcome').locator('footer button').first().click();
    await page.waitForFunction(() => window.location.hash.includes('/guid'), undefined, { timeout: 15_000 });
    await expect(page.locator('.sv-icon-sider').first()).toBeVisible({ timeout: 15_000 });

    const themeButton = page.locator('.app-titlebar__button').first();
    await expect(themeButton).toBeVisible();

    const measureTheme = async (theme: 'dark' | 'light') => {
      const current = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (current !== theme) await themeButton.click();
      await page.waitForFunction(
        (expected) => document.documentElement.getAttribute('data-theme') === expected,
        theme,
        { timeout: 5_000 }
      );

      const result = await page.evaluate((expected) => {
        const names = Object.keys(expected) as Array<keyof typeof expected>;
        const mismatches: Array<{
          className: string;
          expected: number;
          width: number;
          height: number;
          element: string;
        }> = [];
        const counts: Record<string, number> = {};

        for (const element of Array.from(document.querySelectorAll('[class*="sv-icon-"]'))) {
          const name = names.find((candidate) => element.classList.contains(`sv-icon-${candidate}`));
          if (!name) continue;

          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0 || getComputedStyle(element).display === 'none') continue;

          counts[name] = (counts[name] ?? 0) + 1;
          const expectedSize = expected[name];
          if (Math.abs(rect.width - expectedSize) > 0.5 || Math.abs(rect.height - expectedSize) > 0.5) {
            mismatches.push({
              className: `sv-icon-${name}`,
              expected: expectedSize,
              width: Number(rect.width.toFixed(2)),
              height: Number(rect.height.toFixed(2)),
              element: element.outerHTML.slice(0, 180),
            });
          }
        }

        return { counts, mismatches };
      }, scale);

      expect(result.counts.sider, `${theme}: taskbar icons`).toBeGreaterThan(0);
      expect(result.counts.titlebar, `${theme}: titlebar icons`).toBeGreaterThan(0);
      expect(result.mismatches, `${theme}: icons painted away from their token`).toEqual([]);

      await page.screenshot({ path: testInfo.outputPath(`icon-scale-${theme}.png`) });
    };

    await measureTheme('dark');
    await measureTheme('light');
  });
});
