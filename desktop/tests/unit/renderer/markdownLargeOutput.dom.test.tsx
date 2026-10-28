import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const parserCalls = vi.hoisted(() => [] as string[]);
const highlighterCalls = vi.hoisted(() => [] as string[]);

vi.mock('react-markdown', () => ({
  default: ({ children }: { children?: unknown }) => {
    const text = String(children ?? '');
    parserCalls.push(text);
    if (text.includes('__FORCE_MARKDOWN_ERROR__')) throw new Error('forced markdown failure');
    return text;
  },
  defaultUrlTransform: (url: string) => url,
}));

vi.mock('react-syntax-highlighter', () => {
  const Highlighter = ({ children }: { children?: unknown }) => {
    const text = String(children ?? '');
    highlighterCalls.push(text);
    return text;
  };
  return {
    default: Object.assign(Highlighter, {
      supportedLanguages: ['typescript', 'javascript', 'json', 'diff', 'plaintext'],
    }),
  };
});

vi.mock('@/renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  useOptionalPreviewContext: () => undefined,
}));

vi.mock('@/renderer/components/Markdown/ShadowView', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import MarkdownView, { MAX_RICH_MARKDOWN_CHARS } from '@/renderer/components/Markdown';

const largeCodeFence = `\`\`\`ts\n${'const value = 1;\n'.repeat(
  Math.ceil((MAX_RICH_MARKDOWN_CHARS + 1) / 'const value = 1;\n'.length)
)}\`\`\``;

const largeParagraph = `${'paragraph '.repeat(
  Math.ceil((MAX_RICH_MARKDOWN_CHARS + 1) / 'paragraph '.length)
)}END_OF_LARGE_TEXT`;

describe('MarkdownView large output', () => {
  beforeEach(() => {
    parserCalls.length = 0;
    highlighterCalls.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['code fence', largeCodeFence],
    ['paragraph', largeParagraph],
  ])('renders a large %s completely as plain text without parsing or highlighting', (_label, text) => {
    render(<MarkdownView plainTextAbove={MAX_RICH_MARKDOWN_CHARS}>{text}</MarkdownView>);

    const plainText = screen.getByTestId('markdown-large-text');
    expect(plainText.textContent).toBe(text);
    expect(plainText).toHaveStyle({
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    });
    expect(parserCalls).toHaveLength(0);
    expect(highlighterCalls).toHaveLength(0);
  });

  it('falls back to the complete raw text when the Markdown subtree throws', () => {
    const text = '**broken** __FORCE_MARKDOWN_ERROR__';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MarkdownView plainTextAbove={MAX_RICH_MARKDOWN_CHARS}>{text}</MarkdownView>);

    expect(screen.getByTestId('markdown-fallback').textContent).toBe(text);
    const boundaryLogs = consoleError.mock.calls.filter((call) =>
      String(call[0]).startsWith('[MarkdownView]')
    );
    expect(boundaryLogs).toHaveLength(1);
    expect(boundaryLogs[0][0]).toBe('[MarkdownView] Failed to render Markdown; showing plain text.');
    expect(boundaryLogs[0][1]).toBeInstanceOf(Error);
    expect(typeof boundaryLogs[0][2]).toBe('string');
  });
});
