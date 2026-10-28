import { cleanup, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DefaultsSection from '@/renderer/pages/settings/AssistantSettings/editor/DefaultsSection';
import defaultsStyles from '@/renderer/pages/settings/AssistantSettings/editor/DefaultsSection.module.css';
import { cssRules, readRendererCss } from '../../helpers/cssRules';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; count?: number }) =>
      options?.defaultValue?.replace('{{count}}', String(options.count ?? '')) ?? key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/renderer/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

afterEach(cleanup);

const renderDefaults = () =>
  render(
    <DefaultsSection
      localeKey='en-US'
      isBuiltin={false}
      isReadOnlyAssistant={false}
      isCreating={false}
      showSkills
      defaultModelMode='auto'
      setDefaultModelMode={vi.fn()}
      defaultModelValue=''
      setDefaultModelValue={vi.fn()}
      defaultPermissionMode='auto'
      setDefaultPermissionMode={vi.fn()}
      defaultPermissionValue=''
      setDefaultPermissionValue={vi.fn()}
      defaultThoughtLevelMode='auto'
      setDefaultThoughtLevelMode={vi.fn()}
      defaultThoughtLevelValue=''
      setDefaultThoughtLevelValue={vi.fn()}
      defaultSkillsMode='fixed'
      setDefaultSkillsMode={vi.fn()}
      defaultMcpMode='fixed'
      setDefaultMcpMode={vi.fn()}
      modelOptions={[]}
      permissionOptions={[]}
      showThoughtLevelDefault={false}
      thoughtLevelOptions={[]}
      editableSkillOptions={[
        { value: 'skill-a', label: 'Skill A' },
        { value: 'skill-b', label: 'Skill B' },
        { value: 'skill-c', label: 'Skill C' },
      ]}
      selectedSkillValues={['skill-a', 'skill-b', 'skill-c']}
      enabledMcpServers={[
        { id: 'mcp-a', name: 'MCP A' } as never,
        { id: 'mcp-b', name: 'MCP B' } as never,
        { id: 'mcp-c', name: 'MCP C' } as never,
      ]}
      selectedMcpIds={['mcp-a', 'mcp-b', 'mcp-c']}
      setSelectedMcpIds={vi.fn()}
      handleSkillSelectionChange={vi.fn()}
      selectedItemsLabel={(count) => `${count} selected`}
      autoDefaultOptionLabel='Remember last used automatically'
      readonlySelectionSummary={(items, emptyLabel) => (items.length > 0 ? items.join(', ') : emptyLabel)}
    />
  );

describe('DefaultsSection multi-select summary', () => {
  it('uses one live summary tag instead of stacking full-width selected tags', () => {
    renderDefaults();

    for (const testId of ['select-assistant-default-skills', 'select-assistant-default-mcp']) {
      const select = screen.getByTestId(testId);
      const tags = select.querySelectorAll('.arco-tag');

      expect(select).toHaveClass(defaultsStyles.summarySelect);
      expect(select).toHaveClass('arco-select');
      expect(tags).toHaveLength(1);
      expect(tags[0]).toHaveTextContent('3 selected');
      expect(within(select).getByText('3 selected')).toBe(tags[0]);
    }

    const css = readRendererCss('pages/settings/AssistantSettings/editor/DefaultsSection.module.css');
    const rule = (selector: string) => cssRules(css, selector).join('\n');
    expect(rule('.summarySelect:global(.arco-select)')).toContain('flex-wrap: nowrap;');
    expect(rule('.summarySelect :global(.arco-select-view-value)')).toContain('text-overflow: ellipsis;');
    expect(rule('.summarySelect :global(.arco-tag)')).toContain('width: auto;');
    expect(css).not.toMatch(/\.arco-(?:input-tag|select-view-multiple|select-view-tag|tag-content)\b/);
    expect(css).not.toContain('.summaryTagText');
  });
});
