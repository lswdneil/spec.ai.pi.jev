import React, { useRef } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useNativeComposerFocus } from '@/renderer/pages/native/hooks/useNativeComposerFocus';

afterEach(cleanup);

const Screen: React.FC<{ id: string; loading: boolean }> = ({ id, loading }) => {
  const screenRef = useRef<HTMLDivElement>(null);
  useNativeComposerFocus({ screenRef, conversationId: id, isMobile: false, loading });
  return (
    <div ref={screenRef}>
      <textarea data-testid='native-send-input' disabled={loading} />
    </div>
  );
};

describe('useNativeComposerFocus', () => {
  it('focuses the loaded composer after a sidebar row starts another conversation', async () => {
    const view = render(
      <>
        <div role='button' data-native-focus-intent='conversation' data-testid='conversation-row'>
          Second
        </div>
        <Screen id='c1' loading />
      </>
    );

    fireEvent.pointerDown(screen.getByTestId('conversation-row'));
    view.rerender(
      <>
        <div role='button' data-native-focus-intent='conversation' data-testid='conversation-row'>
          Second
        </div>
        <Screen id='c2' loading />
      </>
    );
    view.rerender(
      <>
        <div role='button' data-native-focus-intent='conversation' data-testid='conversation-row'>
          Second
        </div>
        <Screen id='c2' loading={false} />
      </>
    );

    await waitFor(() => expect(screen.getByTestId('native-send-input')).toHaveFocus());
  });

  it('does not take focus from a panel clicked while the conversation loads', async () => {
    const view = render(
      <>
        <div tabIndex={-1} data-testid='outside-panel' />
        <Screen id='c1' loading />
      </>
    );
    const panel = screen.getByTestId('outside-panel');
    panel.focus();
    fireEvent.pointerDown(panel);

    view.rerender(
      <>
        <div tabIndex={-1} data-testid='outside-panel' />
        <Screen id='c1' loading={false} />
      </>
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(panel).toHaveFocus();
    expect(screen.getByTestId('native-send-input')).not.toHaveFocus();
  });
});
