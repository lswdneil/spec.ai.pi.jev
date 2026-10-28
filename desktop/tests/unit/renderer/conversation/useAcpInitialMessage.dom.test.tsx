/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendHttpError } from '@/common/adapter/httpBridge';
import { useAcpInitialMessage } from '@/renderer/pages/conversation/platforms/acp/useAcpInitialMessage';

const { sendMessageInvokeMock, emitterEmitMock } = vi.hoisted(() => ({
  sendMessageInvokeMock: vi.fn(),
  emitterEmitMock: vi.fn(),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: {
      sendMessage: {
        invoke: sendMessageInvokeMock,
      },
    },
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    emit: emitterEmitMock,
  },
}));

vi.mock('@/renderer/utils/file/messageFiles', () => ({
  buildDisplayMessage: (input: string) => input,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe('useAcpInitialMessage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('suppresses tips and reset when initial ACP send hits active-turn busy', async () => {
    sessionStorage.setItem('acp_initial_message_conv-1', JSON.stringify({ input: 'hello', files: [] }));
    sendMessageInvokeMock.mockRejectedValue(
      new BackendHttpError({
        method: 'POST',
        path: '/api/conversations/conv-1/messages',
        status: 409,
        body: { success: false, code: 'CONFLICT', error: 'conversation conv-1 is already running' },
      })
    );

    const markSendFailed = vi.fn();
    const addOrUpdateMessage = vi.fn();
    const resetState = vi.fn();
    const setAiProcessing = vi.fn();

    renderHook(() =>
      useAcpInitialMessage({
        conversation_id: 'conv-1',
        backend: 'codex',
        workspacePath: '/tmp/workspace',
        setAiProcessing,
        resetState,
        markSendStarted: vi.fn(),
        markSendAccepted: vi.fn(),
        markSendFailed,
        checkAndUpdateTitle: vi.fn(),
        addOrUpdateMessage,
      })
    );

    await waitFor(() => expect(sendMessageInvokeMock).toHaveBeenCalledTimes(1));
    expect(markSendFailed).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'busy_conflict', busyKind: 'active_turn' })
    );
    expect(addOrUpdateMessage).not.toHaveBeenCalled();
    expect(resetState).not.toHaveBeenCalled();
    expect(setAiProcessing).not.toHaveBeenCalledWith(false);
  });

  it('keeps ordinary initial ACP send failures visible and resets loading state', async () => {
    const payload = {
      input: 'hello',
      files: [{ kind: 'local', path: '/tmp/attachment.txt' }],
    };
    sessionStorage.setItem('acp_initial_message_conv-1', JSON.stringify(payload));
    sendMessageInvokeMock.mockRejectedValue(new Error('boom'));

    const markSendFailed = vi.fn();
    const addOrUpdateMessage = vi.fn();
    const resetState = vi.fn();
    const setAiProcessing = vi.fn();

    renderHook(() =>
      useAcpInitialMessage({
        conversation_id: 'conv-1',
        backend: 'codex',
        workspacePath: '/tmp/workspace',
        setAiProcessing,
        resetState,
        markSendStarted: vi.fn(),
        markSendAccepted: vi.fn(),
        markSendFailed,
        checkAndUpdateTitle: vi.fn(),
        addOrUpdateMessage,
      })
    );

    await waitFor(() => expect(sendMessageInvokeMock).toHaveBeenCalledTimes(1));
    expect(markSendFailed).toHaveBeenCalledWith({ kind: 'ordinary', reason: 'boom' });
    expect(addOrUpdateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tips',
        content: expect.objectContaining({ type: 'error' }),
      }),
      true
    );
    expect(resetState).toHaveBeenCalledTimes(1);
    expect(setAiProcessing).toHaveBeenCalledWith(false);
    expect(sessionStorage.getItem('acp_initial_message_conv-1')).toBe(JSON.stringify(payload));
  });

  it('clears the retry source only after ACP accepts the initial message', async () => {
    const payload = { input: 'hello', files: [{ kind: 'upload', path: '/tmp/upload.txt' }] };
    sessionStorage.setItem('acp_initial_message_conv-1', JSON.stringify(payload));
    sendMessageInvokeMock.mockResolvedValue({ turn_id: 'turn-1', runtime: null, msg_id: 'msg-1' });

    renderHook(() =>
      useAcpInitialMessage({
        conversation_id: 'conv-1',
        backend: 'codex',
        setAiProcessing: vi.fn(),
        resetState: vi.fn(),
        markSendStarted: vi.fn(),
        markSendAccepted: vi.fn(),
        markSendFailed: vi.fn(),
        checkAndUpdateTitle: vi.fn(),
        addOrUpdateMessage: vi.fn(),
      })
    );

    await waitFor(() => expect(sendMessageInvokeMock).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('acp_initial_message_conv-1')).toBeNull();
  });

  it('does not resend the same initial payload when the effect runs again', async () => {
    sessionStorage.setItem('acp_initial_message_conv-1', JSON.stringify({ input: 'hello', files: [] }));
    sendMessageInvokeMock.mockRejectedValue(new Error('boom'));
    const markSendStarted = vi.fn();
    const markSendFailed = vi.fn();
    const addOrUpdateMessage = vi.fn();
    const resetState = vi.fn();
    const setAiProcessing = vi.fn();
    const checkAndUpdateTitle = vi.fn();

    const { rerender } = renderHook(() =>
      useAcpInitialMessage({
        conversation_id: 'conv-1',
        backend: 'codex',
        setAiProcessing,
        resetState,
        markSendStarted,
        markSendAccepted: vi.fn(),
        markSendFailed,
        checkAndUpdateTitle,
        addOrUpdateMessage,
      })
    );

    await waitFor(() => expect(markSendFailed).toHaveBeenCalledTimes(1));
    rerender();
    await Promise.resolve();
    expect(sendMessageInvokeMock).toHaveBeenCalledTimes(1);
  });
});
