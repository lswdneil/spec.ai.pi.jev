import { useEffect, useRef, type RefObject } from 'react';

type NativeComposerFocusOptions = {
  screenRef: RefObject<Element | null>;
  conversationId: string;
  isMobile: boolean;
  loading: boolean;
};

/**
 * Keeps a conversation chosen from the sidebar from leaving focus on the row. A pointer on the row records that the
 * keyboard belongs in this conversation; a pointer anywhere else records that it does not. Focus waits for the
 * snapshot, so it lands in the real send box rather than the loading state.
 */
export function useNativeComposerFocus({
  screenRef,
  conversationId,
  isMobile,
  loading,
}: NativeComposerFocusOptions): void {
  const autoFocusPendingRef = useRef(true);
  const externalFocusIntentRef = useRef(false);

  useEffect(() => {
    autoFocusPendingRef.current = !externalFocusIntentRef.current;
    const cancelAutoFocus = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const input = screenRef.current?.querySelector<HTMLTextAreaElement>('[data-testid="native-send-input"]');
      const target = event.target;
      const conversationIntent =
        target instanceof Element &&
        target.closest('[data-native-focus-intent="conversation"]') !== null &&
        target.closest('button, input, textarea, select, [role="menu"]') === null;
      const composerIntent =
        target === input ||
        (target instanceof Element && target.closest('[data-composer-zone], [role="menu"]') !== null);
      externalFocusIntentRef.current = !composerIntent && !conversationIntent;
      if (autoFocusPendingRef.current && !composerIntent) autoFocusPendingRef.current = false;
    };
    document.addEventListener('pointerdown', cancelAutoFocus, true);
    return () => document.removeEventListener('pointerdown', cancelAutoFocus, true);
  }, [conversationId, screenRef]);

  useEffect(() => {
    if (isMobile || loading || !autoFocusPendingRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (!autoFocusPendingRef.current) return;
      const input = screenRef.current?.querySelector<HTMLTextAreaElement>('[data-testid="native-send-input"]');
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && active !== input) {
        autoFocusPendingRef.current = false;
        return;
      }
      autoFocusPendingRef.current = false;
      if (input && !input.disabled && active !== input) input.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [conversationId, isMobile, loading, screenRef]);
}
