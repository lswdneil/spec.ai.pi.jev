import type { FileSelectionItem } from '@/renderer/utils/file/fileSelection';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { NativeAttachment } from './useNativeAttachments';
import type { SendMode } from './useNativeConversation';

type NativeComposerDraft = {
  draft: string;
  mode: SendMode;
  mentioned: FileSelectionItem[];
  attachments: NativeAttachment[];
};

type ComposerDraftUpdate = NativeComposerDraft | ((current: NativeComposerDraft) => NativeComposerDraft);

const EMPTY_DRAFT: NativeComposerDraft = {
  draft: '',
  mode: 'steer',
  mentioned: [],
  attachments: [],
};

const MAX_DRAFTS = 20;

// The native conversation screen remounts its composer when another
// conversation opens. Keep the composer state outside React so an A -> B -> A
// switch restores what the person had attached and typed in A.
const drafts = new Map<string, NativeComposerDraft>();

function remember(conversationId: string, draft: NativeComposerDraft): void {
  drafts.delete(conversationId);
  drafts.set(conversationId, draft);
  while (drafts.size > MAX_DRAFTS) {
    const oldest = drafts.keys().next().value;
    if (oldest === undefined) break;
    drafts.delete(oldest);
  }
}

export function clearNativeComposerDrafts(): void {
  drafts.clear();
}

export function useNativeComposerDraft(conversationId: string) {
  const [state, setState] = useState<NativeComposerDraft>(() => drafts.get(conversationId) ?? EMPTY_DRAFT);
  const stateRef = useRef(state);
  const idRef = useRef(conversationId);

  // A draft id can become its session id without remounting the composer.
  // Carry the state to the new id before paint, but never update state during render.
  const idChanged = idRef.current !== conversationId;
  const current = idChanged ? (drafts.get(conversationId) ?? stateRef.current) : state;
  useLayoutEffect(() => {
    if (idRef.current === conversationId) return;
    const previousId = idRef.current;
    const previous = stateRef.current;
    const target = drafts.get(conversationId);
    const next = target ?? previous;
    drafts.delete(previousId);
    remember(conversationId, next);
    idRef.current = conversationId;
    stateRef.current = next;
    setState(next);
  }, [conversationId]);

  const update = useCallback(
    (change: ComposerDraftUpdate) => {
      const current = stateRef.current;
      const next = typeof change === 'function' ? change(current) : change;
      stateRef.current = next;
      remember(conversationId, next);
      setState(next);
    },
    [conversationId]
  );

  return [current, update] as const;
}
