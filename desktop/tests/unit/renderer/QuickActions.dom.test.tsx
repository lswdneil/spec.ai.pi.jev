/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ipcBridge } from '@/common';
import QuickActions from '@/renderer/components/chat/SendBox/QuickActions';
import { addRecentWorkspace } from '@/renderer/components/workspace/recentWorkspaces';

const layoutState = vi.hoisted(() => ({ isMobile: false }));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: layoutState.isMobile }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    dialog: {
      showOpen: { invoke: vi.fn().mockResolvedValue([]) },
    },
  },
}));

vi.mock('@/renderer/components/workspace/recentWorkspaces', () => ({
  addRecentWorkspace: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values
        ? `${key}:${Object.entries(values)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(',')}`
        : key,
  }),
}));

const SKILLS = [
  { name: 'pptx', description: 'deck' },
  { name: 'officecli-pptx', description: 'deck cli' },
  { name: 'pdf', description: 'pdf' },
  { name: 'mermaid', description: 'diagram' },
  { name: 'agent-desktop', description: 'desktop automation' },
  { name: 'cron', description: 'scheduled tasks' },
];

const setup = (skills = SKILLS) => {
  const onSendPrompt = vi.fn().mockResolvedValue(true);
  const onInsertSkill = vi.fn();
  const onLoadSkill = vi.fn();
  render(
    <QuickActions skills={skills} onSendPrompt={onSendPrompt} onInsertSkill={onInsertSkill} onLoadSkill={onLoadSkill} />
  );
  return { onSendPrompt, onInsertSkill, onLoadSkill };
};

const setupWithWorkspace = (workspaceDir: string) => {
  const onSendPrompt = vi.fn().mockResolvedValue(true);
  const onSelectWorkspace = vi.fn();
  render(
    <QuickActions
      skills={SKILLS}
      onSendPrompt={onSendPrompt}
      onInsertSkill={vi.fn()}
      workspaceDir={workspaceDir}
      onSelectWorkspace={onSelectWorkspace}
      workspaceRequired
    />
  );
  return { onSendPrompt, onSelectWorkspace };
};

describe('QuickActions', () => {
  beforeEach(() => {
    layoutState.isMobile = false;
    vi.mocked(ipcBridge.dialog.showOpen.invoke).mockResolvedValue([]);
    vi.mocked(addRecentWorkspace).mockClear();
  });

  it('shows a card only for capabilities whose skill is installed', () => {
    setup([
      { name: 'pptx', description: 'deck' },
      { name: 'pdf', description: 'pdf' },
    ]);

    expect(screen.getByTestId('quick-action-pptx')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-action-docx')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-action-xlsx')).not.toBeInTheDocument();
  });

  it('prefers the first installed skill and sends it with the generated prompt', async () => {
    const { onSendPrompt } = setup();

    fireEvent.click(screen.getByTestId('quick-action-pptx'));
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '季度复盘' } });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    const [prompt, skillName] = onSendPrompt.mock.calls[0];
    expect(skillName).toBe('pptx');
    expect(prompt).toContain('skill=pptx');
    expect(prompt).toContain('topic=季度复盘');
  });

  it('falls back to the next installed skill name', async () => {
    const { onSendPrompt } = setup([{ name: 'officecli-pptx', description: 'deck cli' }]);

    fireEvent.click(screen.getByTestId('quick-action-pptx'));
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '路线图' } });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    expect(onSendPrompt.mock.calls[0][1]).toBe('officecli-pptx');
  });

  it('uses officecli when the native host only loads the combined office skill', async () => {
    const { onSendPrompt } = setup([{ name: 'officecli', description: 'office files' }]);

    expect(screen.getByTestId('quick-action-pptx')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-docx')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-xlsx')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('quick-action-xlsx'));
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '年度预算' } });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    expect(onSendPrompt.mock.calls[0][1]).toBe('officecli');
  });

  it('adds the extra requirements to the generated prompt', async () => {
    const { onSendPrompt } = setup();

    fireEvent.click(screen.getByTestId('quick-action-pptx'));
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '季度复盘' } });
    const notes = screen.getByLabelText('conversation.quickActions.otherRequirements');
    expect(notes).toHaveClass('box-border');
    fireEvent.change(notes, { target: { value: '突出增长数据' } });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    const [prompt] = onSendPrompt.mock.calls[0];
    expect(prompt).toContain('conversation.quickActions.notesPrompt');
    expect(prompt).toContain('notes=突出增长数据');
  });

  it('lets a document have no length limit', async () => {
    const { onSendPrompt } = setup([{ name: 'docx', description: 'document' }]);

    fireEvent.click(screen.getByTestId('quick-action-docx'));
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '季度复盘' } });
    fireEvent.click(screen.getByText('conversation.quickActions.value.unlimited'));
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    expect(onSendPrompt.mock.calls[0][0]).toContain('conversation.quickActions.docx.lengthUnlimitedPrompt');
  });

  it('lets a deck have no page limit', async () => {
    const { onSendPrompt } = setup();

    fireEvent.click(screen.getByTestId('quick-action-pptx'));
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '季度复盘' } });
    fireEvent.click(screen.getByText('conversation.quickActions.value.unlimited'));
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    expect(onSendPrompt.mock.calls[0][0]).toContain('conversation.quickActions.pptx.pagesUnlimitedPrompt');
  });

  it('turns the computer-control card into an agent-desktop task that confirms each step', async () => {
    const { onSendPrompt } = setup([{ name: 'agent-desktop', description: 'desktop automation' }]);

    fireEvent.click(screen.getByTestId('quick-action-computer'));
    fireEvent.change(screen.getByLabelText('conversation.quickActions.computer.topic'), {
      target: { value: '打开记事本并保存会议纪要' },
    });
    expect(screen.getByPlaceholderText('conversation.quickActions.computer.notesPlaceholder')).toBeInTheDocument();
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    const [prompt, skillName, options] = onSendPrompt.mock.calls[0];
    expect(skillName).toBe('agent-desktop');
    expect(options).toEqual({ allowDefaultWorkspace: false });
    expect(prompt).toContain('skill=agent-desktop');
    expect(prompt).toContain('target=conversation.quickActions.value.targetCurrent');
    expect(prompt).toContain('confirm=conversation.quickActions.value.confirmEach');
  });

  it('does not stop the computer-control card at the folder picker, and asks for the home folder instead', async () => {
    const { onSendPrompt } = setupWithWorkspace('');

    fireEvent.click(screen.getByTestId('quick-action-computer'));
    expect(screen.getByTestId('quick-action-workspace-path')).toHaveTextContent(
      'conversation.quickActions.defaultHome'
    );
    fireEvent.change(screen.getByLabelText('conversation.quickActions.computer.topic'), {
      target: { value: '打开记事本并保存会议纪要' },
    });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    expect(onSendPrompt.mock.calls[0][2]).toEqual({ allowDefaultWorkspace: true });
    expect(screen.queryByText('mu.native.home.noFolder')).not.toBeInTheDocument();
  });

  it('enables and inserts a skill chosen from More', () => {
    const { onInsertSkill, onLoadSkill } = setup();

    fireEvent.click(screen.getByTestId('quick-action-more'));
    fireEvent.click(screen.getByText('cron'));

    expect(onLoadSkill).toHaveBeenCalledWith('cron');
    expect(onInsertSkill).toHaveBeenCalledWith('cron');
  });

  it('asks for a workspace before generating when the host needs one', () => {
    const { onSendPrompt } = setupWithWorkspace('');

    fireEvent.click(screen.getByTestId('quick-action-pptx'));
    expect(screen.getByTestId('quick-action-workspace-path')).toHaveTextContent('conversation.quickActions.notChosen');
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '季度复盘' } });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    expect(onSendPrompt).not.toHaveBeenCalled();
    expect(screen.getByText('mu.native.home.noFolder')).toBeInTheDocument();
  });

  it('picks a workspace from the card dialog', async () => {
    const { onSelectWorkspace } = setupWithWorkspace('');
    vi.mocked(ipcBridge.dialog.showOpen.invoke).mockResolvedValue(['C:/work/deck']);

    fireEvent.click(screen.getByTestId('quick-action-pptx'));
    fireEvent.click(screen.getByTestId('quick-action-workspace'));

    await waitFor(() => expect(onSelectWorkspace).toHaveBeenCalledWith('C:/work/deck'));
    expect(addRecentWorkspace).toHaveBeenCalledWith('C:/work/deck');
  });

  it('sends straight away when the card dialog already shows a workspace', async () => {
    const { onSendPrompt } = setupWithWorkspace('C:/work/deck');

    fireEvent.click(screen.getByTestId('quick-action-pptx'));
    expect(screen.getByTestId('quick-action-workspace-path')).toHaveTextContent('C:/work/deck');
    fireEvent.change(screen.getByLabelText('conversation.quickActions.topic'), { target: { value: '季度复盘' } });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('mu.native.home.noFolder')).not.toBeInTheDocument();
  });

  it('announces SCH, PCB and CAD design and opens a notice instead of the composer', () => {
    const { onSendPrompt } = setup();

    expect(screen.getByTestId('quick-action-sch')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-pcb')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-cad')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('quick-action-pcb'));

    expect(screen.getByTestId('quick-action-coming-soon')).toBeInTheDocument();
    expect(screen.getByText('conversation.quickActions.comingSoon')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-action-dialog')).not.toBeInTheDocument();
    expect(onSendPrompt).not.toHaveBeenCalled();
  });

  it('renders nothing on mobile', () => {
    layoutState.isMobile = true;
    setup();

    expect(screen.queryByTestId('quick-action-cards')).not.toBeInTheDocument();
  });
});
