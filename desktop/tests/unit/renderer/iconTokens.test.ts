import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const desktop = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(desktop, 'packages/desktop/src/renderer', path), 'utf8');

const shell = [
  'components/layout/Layout.tsx',
  'components/layout/Titlebar/index.tsx',
  'components/layout/MobileTabBar.tsx',
  'components/layout/WindowControls.tsx',
  'components/layout/Sider/DenseSider.tsx',
  'components/layout/Sider/DenseSiderFooter.tsx',
  'components/layout/Sider/SiderFooter.tsx',
  'components/layout/Sider/SiderNav/SiderToolbar.tsx',
  'components/layout/Sider/SiderNav/SiderSearchEntry.tsx',
  'components/layout/Sider/SiderNav/SiderScheduledEntry.tsx',
  'components/layout/WorkPanel/WorkPanelTabs.tsx',
  'components/layout/Sider/CommandPalette/CommandPalettePanel.tsx',
  'pages/settings/components/SettingsSider.tsx',
];

describe('the shared shell icon scale', () => {
  it('names the sizes once, in the token source', () => {
    const tokens = read('styles/specjev/tokens.css');
    for (const name of ['xs', 'sm', 'md', 'lg', 'xl']) expect(tokens).toContain(`--sv-icon-${name}:`);
    expect(tokens).toContain('--sv-icon-sider: var(--sv-icon-md);');
    expect(tokens).toContain('--sv-icon-titlebar: var(--sv-icon-lg);');
  });

  it('keeps shell icons on the scale instead of literal pixel classes', () => {
    for (const path of shell) {
      const source = read(path);
      expect(source, path).not.toMatch(/h-3\.5|h-4 w-4|h-5 w-5|h-\[(?:18|20)px\]|size=\{[0-9]+\}|size='[0-9]+'/);
    }
  });

  it('uses one rail size for the sidebar in both states', () => {
    for (const path of [
      'components/layout/Sider/DenseSider.tsx',
      'components/layout/Sider/DenseSiderFooter.tsx',
      'components/layout/Layout.tsx',
      'pages/settings/components/SettingsSider.tsx',
    ]) {
      expect(read(path), path).toContain('sv-icon-sider');
    }
  });
});
