import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import conversation from '@/renderer/services/i18n/locales/en-US/conversation.json';
import ConversationTitleMinimap from '@/renderer/pages/conversation/components/ConversationTitleMinimap';
import minimapStyles from '@/renderer/pages/conversation/components/ConversationTitleMinimap/ConversationTitleMinimap.module.css';

const loadMessages = vi.hoisted(() => vi.fn());
vi.mock('@/renderer/utils/chat/messagePagination', () => ({
  loadAllConversationMessagesPaged: loadMessages,
}));

const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: 'en',
    resources: { en: { translation: { conversation } } },
    interpolation: { escapeValue: false },
  });
});
beforeEach(() => {
  loadMessages.mockReset();
  loadMessages.mockResolvedValue([]);
});
afterEach(cleanup);

describe('the conversation minimap search field', () => {
  it('styles the live input directly and keeps focus, typing and clearing working', async () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ConversationTitleMinimap conversation_id='conversation-1' />
      </I18nextProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Search conversation' }));
    const idleInput = await screen.findByRole('textbox', { name: 'Search conversation' });
    const field = idleInput.closest(`.${minimapStyles.searchField}`);
    expect(field).not.toBeNull();
    expect(idleInput).toHaveClass(minimapStyles.searchInput);
    expect(idleInput).toHaveClass(minimapStyles.searchInputIdle);
    expect(idleInput).toHaveAttribute('readonly');
    expect(idleInput).toHaveAttribute('placeholder', 'Search this conversation');
    expect(idleInput.parentElement?.querySelector('svg')).toHaveClass(minimapStyles.searchPrefix);

    fireEvent.focus(idleInput);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search conversation' })).not.toHaveAttribute('readonly'));
    const activeInput = screen.getByRole('textbox', { name: 'Search conversation' });
    expect(activeInput).not.toHaveClass(minimapStyles.searchInputIdle);

    fireEvent.change(activeInput, { target: { value: 'login' } });
    expect(activeInput).toHaveValue('login');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByRole('textbox', { name: 'Search conversation' })).toHaveValue('');
    expect(loadMessages).toHaveBeenCalledWith('conversation-1');

    const css = readFileSync(
      join(
        __dirname,
        '../../../../packages/desktop/src/renderer/pages/conversation/components/ConversationTitleMinimap/ConversationTitleMinimap.module.css'
      ),
      'utf8'
    );
    const rule = (selector: string) => {
      const start = css.indexOf(`\n${selector} {`);
      return start < 0 ? '' : css.slice(start, css.indexOf('\n}', start));
    };
    expect(rule('.searchField')).toContain('height: 34px;');
    expect(rule('.searchField:focus-within')).toContain('border-color: rgb(var(--primary-6));');
    expect(rule('.searchInput')).toContain('padding-inline: 30px 30px;');
    expect(rule('.searchInput[readonly]')).toContain('cursor: text;');
    expect(rule('.searchInputIdle')).toContain('cursor: text;');
    expect(css).toContain('.searchInput::placeholder');
    expect(css).not.toContain(':global(.arco-input');
  });
});
