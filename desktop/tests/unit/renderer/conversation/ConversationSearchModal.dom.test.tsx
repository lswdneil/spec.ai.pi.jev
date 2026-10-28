import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MuModal from '@/renderer/components/base/MuModal';
import { cssRules, readRendererCss } from '../../../helpers/cssRules';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({ fontScale: 1 }),
}));

afterEach(cleanup);

describe('conversation search modal surface', () => {
  it('targets the live MuModal classes while keeping the surrounding chrome transparent', () => {
    render(
      <MuModal
        visible
        className='conversation-search-modal'
        header={{ title: 'Search', showClose: false }}
        footer={null}
        contentStyle={{ background: 'transparent', padding: '0', overflow: 'hidden' }}
      >
        <div className='conversation-search-modal__panel'>Results</div>
      </MuModal>
    );

    const modal = document.querySelector<HTMLElement>('.mu-modal.conversation-search-modal');
    const wrapper = modal?.querySelector<HTMLElement>('.mu-modal-wrapper');
    const body = modal?.querySelector<HTMLElement>('.mu-modal-body-content');

    expect(modal).not.toBeNull();
    expect(wrapper).not.toBeNull();
    expect(body).not.toBeNull();

    const css = readRendererCss('pages/conversation/GroupedHistory/ConversationSearchPopover.css');
    expect(css).not.toContain('.arco-modal');
    expect(
      cssRules(css, '.conversation-search-modal.mu-modal').some((rule) =>
        rule.includes('background: transparent !important;')
      )
    ).toBe(true);
    expect(
      cssRules(css, '.conversation-search-modal .mu-modal-body-content').some((rule) =>
        rule.includes('padding: 0 !important;')
      )
    ).toBe(true);
    expect(
      cssRules(css, '.conversation-search-modal.mu-modal .mu-modal-wrapper').some(
        (rule) =>
          rule.includes('background: var(--conversation-search-panel-bg) !important;') &&
          rule.includes('outline: 1px solid var(--conversation-search-panel-outline);') &&
          rule.includes('backdrop-filter: blur(10px) saturate(115%);')
      )
    ).toBe(true);
  });
});
