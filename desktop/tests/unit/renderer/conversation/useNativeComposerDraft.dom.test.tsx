import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearNativeComposerDrafts,
  useNativeComposerDraft,
} from '@/renderer/pages/native/hooks/useNativeComposerDraft';

afterEach(() => {
  cleanup();
  clearNativeComposerDrafts();
  vi.restoreAllMocks();
});

const Harness: React.FC<{ id: string }> = ({ id }) => {
  const [draft, update] = useNativeComposerDraft(id);
  return (
    <div>
      <span data-testid='draft'>{draft.draft}</span>
      <button type='button' onClick={() => update((current) => ({ ...current, draft: `${id}:${draft.draft.length}` }))}>
        update
      </button>
    </div>
  );
};

describe('useNativeComposerDraft', () => {
  it('follows a draft id to a cached session id without remounting', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const session = render(<Harness id='session-1' />);
    act(() => screen.getByRole('button').click());
    expect(screen.getByTestId('draft')).toHaveTextContent('session-1:0');
    session.unmount();

    const view = render(<Harness id='draft-1' />);
    act(() => screen.getByRole('button').click());
    expect(screen.getByTestId('draft')).toHaveTextContent('draft-1:0');

    view.rerender(<Harness id='session-1' />);
    expect(screen.getByTestId('draft')).toHaveTextContent('session-1:0');
    expect(consoleError).not.toHaveBeenCalled();
  });
});
