import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useCompositionInput } from '@/renderer/hooks/chat/useCompositionInput';

function Harness() {
  const { compositionHandlers, commitComposition, createKeyDownHandler, isComposingState } = useCompositionInput();
  const [committed, setCommitted] = useState('');
  const [sent, setSent] = useState(0);
  return (
    <>
      <textarea
        data-testid='ime-input'
        data-composing={String(isComposingState)}
        {...compositionHandlers}
        onCompositionEndCapture={(event) => {
          compositionHandlers.onCompositionEndCapture(event);
          setCommitted(commitComposition(event).committedValue);
        }}
        onKeyDown={createKeyDownHandler(() => setSent((count) => count + 1))}
      />
      <output data-testid='committed'>{committed}</output>
      <output data-testid='sent'>{sent}</output>
    </>
  );
}

describe('useCompositionInput', () => {
  it('keeps the text an IME committed when the textarea value is empty', () => {
    render(<Harness />);
    const input = screen.getByTestId('ime-input');

    fireEvent.compositionStart(input);
    expect(input).toHaveAttribute('data-composing', 'true');
    fireEvent.compositionEnd(input, { data: '你好' });

    expect(screen.getByTestId('committed')).toHaveTextContent('你好');
    expect(input).toHaveAttribute('data-composing', 'false');
  });

  it('sends on Enter when a stale composition ref remains but the native event is not composing', () => {
    render(<Harness />);
    const input = screen.getByTestId('ime-input');

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(screen.getByTestId('sent')).toHaveTextContent('1');
    expect(input).toHaveAttribute('data-composing', 'false');
  });
});
