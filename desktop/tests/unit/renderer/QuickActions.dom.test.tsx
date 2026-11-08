/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import QuickActions from '@/renderer/components/chat/SendBox/QuickActions';

const layoutState = vi.hoisted(() => ({ isMobile: false }));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: layoutState.isMobile }),
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

describe('QuickActions', () => {
  beforeEach(() => {
    layoutState.isMobile = false;
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
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '季度复盘' } });
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
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '路线图' } });
    fireEvent.click(screen.getByText('conversation.quickActions.generate'));

    await waitFor(() => expect(onSendPrompt).toHaveBeenCalledTimes(1));
    expect(onSendPrompt.mock.calls[0][1]).toBe('officecli-pptx');
  });

  it('enables and inserts a skill chosen from More', () => {
    const { onInsertSkill, onLoadSkill } = setup();

    fireEvent.click(screen.getByTestId('quick-action-more'));
    fireEvent.click(screen.getByText('cron'));

    expect(onLoadSkill).toHaveBeenCalledWith('cron');
    expect(onInsertSkill).toHaveBeenCalledWith('cron');
  });

  it('renders nothing on mobile', () => {
    layoutState.isMobile = true;
    setup();

    expect(screen.queryByTestId('quick-action-cards')).not.toBeInTheDocument();
  });
});
