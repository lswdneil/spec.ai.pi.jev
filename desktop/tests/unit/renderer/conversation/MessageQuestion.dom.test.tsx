import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IMessageAsk } from '@/common/chat/chatLib';
import MessageQuestion from '@/renderer/pages/conversation/Messages/MessageQuestion';
import questionStyles from '@/renderer/pages/conversation/Messages/MessageQuestion.module.css';
import { cssRules, readRendererCss } from '../../../helpers/cssRules';

const { answerAsk } = vi.hoisted(() => ({
  answerAsk: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  conversation: {
    answerAsk: { invoke: answerAsk },
  },
}));

afterEach(cleanup);

const message: IMessageAsk = {
  id: 'ask-1',
  conversation_id: 'conversation-1',
  type: 'ask',
  content: {
    session_id: 'session-1',
    request_id: 'request-1',
    questions: [
      {
        header: 'Choice',
        question: 'Pick one',
        options: [
          {
            label: 'Long label that must remain in its own flexible text column',
            description: 'The description wraps below the label without moving the radio off its first line.',
          },
        ],
      },
      {
        header: 'Multiple',
        question: 'Pick any',
        multiSelect: true,
        options: [
          {
            label: 'Another long label for the checkbox row',
            description: 'Long descriptions keep the checkbox aligned to the first line of text.',
          },
        ],
      },
    ],
  },
};

describe('MessageQuestion option layout', () => {
  it('uses the live control and text wrappers and keeps selection working', () => {
    render(<MessageQuestion message={message} />);

    const radioRow = screen.getByTestId(
      'message-question-option-0-Long label that must remain in its own flexible text column'
    );
    const checkbox = screen.getByTestId(
      'message-question-option-1-Another long label for the checkbox row'
    );
    const checkboxRow = checkbox.closest('label') as HTMLLabelElement;

    expect(radioRow).toHaveClass(questionStyles.optionRow);
    expect(checkboxRow).toHaveClass(questionStyles.optionRow);
    expect(radioRow.children[0].tagName).toBe('SPAN');
    expect(radioRow.children[1]).toHaveClass(questionStyles.optionText);
    expect(checkboxRow.children[0]).toBe(checkbox);
    expect(checkboxRow.children[1]).toHaveClass(questionStyles.optionText);

    fireEvent.click(radioRow);
    fireEvent.click(checkbox);
    expect(screen.getByTestId('message-question-submit')).not.toBeDisabled();

    const css = readRendererCss('pages/conversation/Messages/MessageQuestion.module.css');
    const rule = (selector: string) => cssRules(css, selector).join('\n');
    expect(rule('.optionRow')).toContain('align-items: flex-start !important;');
    expect(rule('.optionRow > :first-child')).toContain('margin-top: 3px;');
    expect(rule('.optionText')).toContain('flex: 1 1 auto;');
    expect(css).not.toMatch(/arco-(?:icon-hover|radio-text|checkbox-text)/);
  });
});
