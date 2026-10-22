import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const desktop = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(desktop, 'packages/desktop/src/renderer', path), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const themed = [
  'components/brand/Brand.module.css',
  'components/chat/MobileActionSheet/MobileActionSheet.module.css',
  'components/chat/SendBox/sendbox.css',
  'components/media/FileAttachButton.tsx',
  'components/kernel/MuHero.module.css',
  'components/kernel/KernelBar.module.css',
  'pages/guid/components/AssistantSelectionArea.tsx',
  'pages/guid/index.module.css',
  'pages/conversation/GroupedHistory/ConversationSearchPopover.css',
  'pages/conversation/Messages/components/MessageToolCall.tsx',
  'pages/conversation/Preview/components/PreviewPanel/PreviewContextMenu.tsx',
  'pages/settings/components/settings.css',
  'pages/settings/KyrnSettings/providers/providers.module.css',
  'pages/settings/KyrnSettings/sections/sections.module.css',
  'pages/welcome/Welcome.module.css',
  'styles/layout.css',
  'styles/legacy-overrides.css',
  'components/base/MuSearchInput.module.css',
  'components/chat/MentionMenuShell.tsx',
  'components/layout/WorkPanel/WorkPanel.module.css',
  'components/Markdown/CodeBlock.tsx',
  'components/Markdown/DiagramZoomOverlay.tsx',
  'components/Markdown/ShadowView.tsx',
  'components/media/FilePreview.tsx',
  'components/media/HorizontalFileList.tsx',
  'components/settings/ScaleControl.tsx',
  'components/workspace/WorkspaceFolderSelect.tsx',
  'pages/conversation/components/ChatLayout/MobileWorkspaceOverlay.tsx',
  'pages/conversation/components/ChatTitleEditor.tsx',
  'pages/conversation/components/ConversationTitleMinimap/ConversationTitleMinimap.module.css',
  'pages/conversation/components/ConversationTitleMinimap/minimapTypes.ts',
  'pages/conversation/Messages/components/MessageText.tsx',
  'pages/conversation/Messages/components/SelectionReplyButton.tsx',
  'pages/cron/components/CronJobManager.tsx',
  'styles/markdown.css',
];

describe('Dense theme and type tokens', () => {
  it('keeps UI colours in the theme sources, not in UI sheets', () => {
    for (const path of themed) {
      const source = stripComments(read(path));
      expect(source, path).not.toMatch(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/);
      expect(source, path).not.toMatch(/rgba?\((?!var\()/);
    }
  });

  it('does not hard-code a font family in UI sheets', () => {
    for (const path of themed) {
      expect(read(path), path).not.toMatch(/font-family:[ \t]*(?!var\(|inherit)\S/);
    }
  });

  it('lets the Dense token block outrank the colour-scheme blocks', () => {
    expect(read('styles/specjev/dense.css')).toContain('html[data-sv-ui="dense"][data-theme] {');
  });

  it('uses the UI typeface for every non-code label', () => {
    for (const path of [
      'components/kernel/MuHero.module.css',
      'components/kernel/KernelBar.module.css',
      'pages/settings/components/settings.css',
      'pages/settings/KyrnSettings/providers/providers.module.css',
    ]) {
      expect(read(path), path).toContain('var(--sv-font-ui)');
    }
  });
});
