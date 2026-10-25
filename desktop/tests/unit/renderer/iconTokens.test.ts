import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const desktop = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(desktop, 'packages/desktop/src/renderer', path), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(join(desktop, 'packages/desktop/src/renderer', dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : entry.name.endsWith('.tsx') ? [path] : [];
  });

const literalIconSize =
  /(?<![a-z])h-3 w-3|(?<![a-z])h-3\.5|(?<![a-z])h-4 w-4|(?<![a-z])h-5 w-5|(?<![a-z])h-\[(?:18|20)px\]|size=\{[0-9]+\}|size='[0-9]+'/;

/** Avatars, logos, spinners and 24/28px illustration marks are content-sized, not icon-scale. */
const withoutContentSizedMarks = (source: string) =>
  source
    .replace(/<(?:Avatar|AssistantAvatar|ProviderMark|EndpointMark|MuMark|ThemedLogo|Spin|CronJobIndicator)\b[^>]*>/g, '')
    .replace(/size=(?:\{(?:24|28)\}|['"](?:24|28)['"])/g, '');

const shell = [
  'components/layout/Layout.tsx',
  'components/layout/Titlebar/index.tsx',
  'components/layout/MobileTabBar.tsx',
  'components/layout/WindowControls.tsx',
  'components/layout/Sider/DenseSider.tsx',
  'components/layout/Sider/DenseSiderFooter.tsx',
  'components/layout/WorkPanel/WorkPanelTabs.tsx',
  'components/layout/Sider/CommandPalette/CommandPalettePanel.tsx',
  'components/settings/UpdateNotice.tsx',
  'pages/settings/components/SettingsSider.tsx',
  'components/chat/SendBox/index.tsx',
  'components/chat/SendBox/SendArrowIcon.tsx',
  'components/chat/CommandQueuePanel.tsx',
  'components/Markdown/CodeBlock.tsx',
  'components/Markdown/MermaidBlock.tsx',
  'components/Markdown/WavedromBlock.tsx',
  'pages/guid/components/GuidActionRow.tsx',
];

describe('the shared shell icon scale', () => {
  it('names the sizes once, in the token source', () => {
    const tokens = read('styles/specjev/tokens.css');
    for (const name of ['xs', 'sm', 'md', 'lg', 'xl']) expect(tokens).toContain(`--sv-icon-${name}:`);
    expect(tokens).toContain('--sv-icon-sider: var(--sv-icon-lg);');
    expect(tokens).toContain('--sv-icon-titlebar: var(--sv-icon-lg);');
  });

  it('keeps shell icons on the scale instead of literal pixel classes', () => {
    for (const path of shell) {
      const source = read(path);
      expect(source, path).not.toMatch(literalIconSize);
    }
  });

  it('keeps the message surface on the icon scale', () => {
    for (const path of walk('pages/conversation/Messages')) {
      expect(read(path), path).not.toMatch(literalIconSize);
    }
  });

  it('keeps settings, preview and agent icons on the icon scale', () => {
    for (const dir of ['pages/settings', 'pages/conversation/Preview', 'components/agent']) {
      for (const path of walk(dir)) {
        expect(withoutContentSizedMarks(read(path)), path).not.toMatch(literalIconSize);
      }
    }
  });

  it('keeps conversation chrome, media, native and scheduled icons on the icon scale', () => {
    for (const dir of [
      'pages/conversation/GroupedHistory',
      'pages/conversation/components/ChatLayout',
      'components/media',
      'pages/conversation/SourceControl',
      'pages/native',
      'pages/cron/components',
      'pages/cron/ScheduledTasksPage',
      'pages/conversation/platforms',
    ]) {
      for (const path of walk(dir)) {
        expect(withoutContentSizedMarks(read(path)), path).not.toMatch(literalIconSize);
      }
    }
  });

  it('keeps settings dialogs, workspace, guid, markdown, hive, base and explorer icons on the icon scale', () => {
    for (const dir of [
      'components/settings/SettingsModal',
      'components/workspace',
      'pages/DesignSystem',
      'pages/guid/components',
      'components/Markdown',
      'pages/conversation/KyrnPanel',
      'components/base',
      'pages/conversation/explorer',
    ]) {
      for (const path of walk(dir)) {
        expect(withoutContentSizedMarks(read(path)), path).not.toMatch(literalIconSize);
      }
    }
  });

  it('keeps chat chrome, conversation panels, showcase and icon primitives on the icon scale', () => {
    for (const dir of ['components/chat', 'pages/conversation/components', 'pages/conversation/PlanBar']) {
      for (const path of walk(dir)) {
        expect(withoutContentSizedMarks(read(path)), path).not.toMatch(literalIconSize);
      }
    }
    for (const path of [
      'pages/TestShowcase.tsx',
      'ui/alert.tsx',
      'ui/button.tsx',
      'ui/collapse.tsx',
      'ui/dialog.tsx',
      'ui/dropdown.tsx',
      'ui/empty.tsx',
      'ui/image.tsx',
      'ui/input.tsx',
      'ui/pagination.tsx',
      'ui/tree.tsx',
    ]) {
      expect(withoutContentSizedMarks(read(path)), path).not.toMatch(literalIconSize);
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
