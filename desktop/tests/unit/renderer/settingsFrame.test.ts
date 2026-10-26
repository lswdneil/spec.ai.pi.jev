import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const renderer = join(fileURLToPath(new URL('../../../', import.meta.url)), 'packages/desktop/src/renderer');
const read = (path: string) => readFileSync(join(renderer, path), 'utf8');

describe('settings frame and sidebar scroll', () => {
  it('paints every settings page on the page background and keeps Appearance in the shared frame', () => {
    expect(read('pages/settings/components/SettingsPageWrapper.tsx')).toContain('bg-sv-bg');
    const appearance = read('pages/settings/AppearanceSettings/AppearanceV2.tsx');
    expect(appearance).toContain('<SettingsPage');
    expect(appearance).not.toContain('max-w-[820px]');
  });

  it('gives both sidebar scroll areas the auto-hiding scrollbar class', () => {
    expect(read('components/layout/Sider/DenseSider.tsx')).toContain('sv-sider-scroll');
    expect(read('pages/settings/components/SettingsSider.tsx')).toContain('sv-sider-scroll');
  });

  it('uses the same UI typeface for settings group headers and page rows', () => {
    const dense = read('styles/specjev/dense.css');
    for (const selector of ['.settings-sider__group-header', '.settings-sider__item-label']) {
      const block = dense.match(
        new RegExp(`html\\[data-sv-ui="dense"\\] ${selector.replaceAll('.', '\\.')}\\s*\\{[^}]*\\}`)
      );
      expect(block?.[0]).toContain('font-family: var(--sv-font-ui)');
    }
  });
});
