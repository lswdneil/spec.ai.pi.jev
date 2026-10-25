/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ConversationSearchPopover from '@/renderer/pages/conversation/GroupedHistory/ConversationSearchPopover';
import { Message } from '@/renderer/ui';
import { emitter, useAddEventListener } from '@/renderer/utils/emitter';
import CommandPalettePanel from './CommandPalettePanel';
import type { PaletteItem } from './paletteGroups';
import styles from './CommandPalette.module.css';

/**
 * Open the palette, or close it when it is open.
 */
export const toggleCommandPalette = (): void => {
  emitter.emit('commandPalette.toggle');
};

type CommandPaletteProps = {
  /** Called after the palette has moved to a conversation, a settings page, the home page or the scheduled tasks. */
  onNavigate?: () => void;
};

/**
 * One search box for the whole app (Cmd/Ctrl+K, or the sidebar's search entry): it opens a conversation, goes to a
 * settings page, starts a conversation or opens the scheduled tasks, or sends one of the harness's slash commands into
 * the open conversation.
 *
 * The message search stays beside it. The palette finds conversations by title; the message search looks through
 * what was said in them and jumps to the message, so it keeps Cmd/Ctrl+Shift+F, and the palette hands a query on to
 * it from its last row.
 */
const CommandPalette: React.FC<CommandPaletteProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dense = true;
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  // Where the focus was before the palette opened (the message input, say), to hand it back on Esc.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(false);

  const close = useCallback((restoreFocus: boolean) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  useAddEventListener(
    'commandPalette.toggle',
    () => {
      if (openRef.current) {
        close(true);
        return;
      }
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    },
    [close]
  );

  // After the dialog has let go of the focus, not before: its focus lock would pull it straight back.
  useEffect(() => {
    if (open) return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (restoreFocusRef.current && target?.isConnected) target.focus();
    restoreFocusRef.current = false;
  }, [open]);

  const run = useCallback(
    (item: PaletteItem) => {
      switch (item.kind) {
        case 'conversation':
          close(false);
          // A native conversation has a page of its own.
          void navigate(item.path ?? `/conversation/${item.conversationId}`);
          onNavigate?.();
          return;
        case 'settings':
          close(false);
          void navigate(item.path);
          onNavigate?.();
          return;
        case 'action':
          close(false);
          // As the sidebar's own rows do: a new conversation starts from a fresh home page.
          if (item.action === 'newConversation') void navigate('/guid', { state: { resetAssistant: true } });
          else void navigate('/scheduled');
          onNavigate?.();
          return;
        case 'messages':
          close(false);
          emitter.emit('conversationSearch.open', item.query);
          return;
        case 'command':
          // Back to where the person was typing; the send box sends the command as if it had been typed there. While
          // the agent works, the command waits for the turn to end; the palette is gone by then, so a note says so.
          close(true);
          emitter.emit('sendbox.command', `/${item.name}`, item.conversationId, (state) => {
            if (state === 'waiting') Message.info(t('common.commandPalette.commandWaits'));
          });
      }
    },
    [close, navigate, onNavigate, t]
  );

  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) close(true);
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className='fixed inset-0 z-[1000] bg-[var(--sv-scrim)]' />
          <DialogPrimitive.Content
            className={classNames(styles.radix, dense && styles.dense)}
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className='sr-only'>{t('common.commandPalette.title')}</DialogPrimitive.Title>
            <CommandPalettePanel onRun={run} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <ConversationSearchPopover renderTrigger={() => null} onConversationSelect={onNavigate} />
    </>
  );
};

export default CommandPalette;
