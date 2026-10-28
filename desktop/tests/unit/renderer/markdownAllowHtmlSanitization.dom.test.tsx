import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  useOptionalPreviewContext: () => undefined,
}));

vi.mock('@/renderer/components/media/LocalImageView', () => ({
  default: () => null,
}));

vi.mock('@/renderer/components/Markdown/ShadowView', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

import MarkdownView, { MAX_RICH_MARKDOWN_CHARS } from '@/renderer/components/Markdown';

describe('MarkdownView allowHtml', () => {
  it('keeps ordinary-size content on the rich Markdown path when the limit is enabled', () => {
    render(
      <MarkdownView plainTextAbove={MAX_RICH_MARKDOWN_CHARS}>
        {'**bold** and **also bold**'}
      </MarkdownView>
    );

    expect(screen.getByText('bold')).toHaveProperty('tagName', 'STRONG');
    expect(screen.queryByTestId('markdown-large-text')).not.toBeInTheDocument();
  });

  it('strips scripts and event handlers from raw HTML', () => {
    const { container } = render(
      <MarkdownView allowHtml>
        {'before<script>window.__xss = 1</script><b onclick="window.__xss = 2">safe</b>after'}
      </MarkdownView>
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('b')?.getAttribute('onclick')).toBeNull();
    expect(container).toHaveTextContent('beforesafeafter');
  });

  it('drops dangerous hrefs while keeping ordinary Markdown rendering', () => {
    const { container } = render(
      <MarkdownView allowHtml>
        {'**bold** [click](javascript:alert(1)) <a href="javascript:alert(2)">raw</a>'}
      </MarkdownView>
    );

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    for (const anchor of container.querySelectorAll('a')) expect(anchor.getAttribute('href')).toBeNull();
  });

  it('removes embedded frames and srcdoc content from raw HTML', () => {
    const { container } = render(
      <MarkdownView allowHtml>
        {'before<iframe srcdoc="<script>window.__xss = 3</script>"></iframe><meta http-equiv="refresh" content="0;url=https://example.com">after'}
      </MarkdownView>
    );

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('meta')).toBeNull();
    expect(container).toHaveTextContent('beforeafter');
  });
});
