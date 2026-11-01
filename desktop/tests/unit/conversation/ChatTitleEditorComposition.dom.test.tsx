/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/pages/conversation/components/ConversationTitleMinimap', () => ({
  default: () => null,
}));

import ChatTitleEditor from '@/renderer/pages/conversation/components/ChatTitleEditor';

describe('ChatTitleEditor composition handling', () => {
  it('does not commit or cancel a rename from an IME composition keypress', () => {
    const setEditingTitle = vi.fn();
    const submitTitleRename = vi.fn().mockResolvedValue(undefined);

    render(
      <ChatTitleEditor
        editingTitle
        titleDraft='draft'
        setTitleDraft={vi.fn()}
        setEditingTitle={setEditingTitle}
        renameLoading={false}
        canRenameTitle
        submitTitleRename={submitTitleRename}
        titleAreaMaxWidth={400}
        title='original'
        conversation_id='conv-1'
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });

    expect(submitTitleRename).not.toHaveBeenCalled();
    expect(setEditingTitle).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(submitTitleRename).toHaveBeenCalledTimes(1);
  });
});
