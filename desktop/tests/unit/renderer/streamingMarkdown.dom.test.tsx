import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const markdownCalls = vi.hoisted(() => [] as string[]);

vi.mock('@renderer/components/Markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => {
    const text = String(children ?? '');
    markdownCalls.push(text);
    return <div data-testid='markdown-block'>{text}</div>;
  },
}));

import StreamingMarkdown from '@/renderer/components/Markdown/StreamingMarkdown';

describe('StreamingMarkdown', () => {
  beforeEach(() => {
    markdownCalls.length = 0;
  });

  it('keeps an open paragraph as plain text and turns it into Markdown at the next blank line', () => {
    const { rerender } = render(<StreamingMarkdown>{'first paragraph'}</StreamingMarkdown>);

    expect(screen.getByTestId('message-streaming-tail')).toHaveTextContent('first paragraph');
    expect(markdownCalls).toEqual([]);

    rerender(<StreamingMarkdown>{'first paragraph\n\nsecond paragraph'}</StreamingMarkdown>);

    expect(markdownCalls).toEqual(['first paragraph\n']);
    expect(screen.getByTestId('markdown-block')).toHaveTextContent('first paragraph');
    expect(screen.getByTestId('message-streaming-tail')).toHaveTextContent('second paragraph');
  });

  it('keeps an open code block plain and passes it to Markdown only after the closing fence', () => {
    const { rerender } = render(<StreamingMarkdown>{'```ts\nconst answer = 42;'}</StreamingMarkdown>);

    expect(screen.getByTestId('message-streaming-tail')).toHaveTextContent('```ts');
    expect(markdownCalls).toEqual([]);

    rerender(<StreamingMarkdown>{'```ts\nconst answer = 42;\n```'}</StreamingMarkdown>);

    expect(markdownCalls).toEqual(['```ts\nconst answer = 42;\n```']);
    expect(screen.queryByTestId('message-streaming-tail')).not.toBeInTheDocument();
  });

  it('does not reparse a settled block when later chunks only grow the tail', () => {
    const { rerender } = render(<StreamingMarkdown>{'```ts\nconst answer = 42;\n```'}</StreamingMarkdown>);
    expect(markdownCalls).toHaveLength(1);

    rerender(<StreamingMarkdown>{'```ts\nconst answer = 42;\n```\n\nnext paragraph'}</StreamingMarkdown>);
    rerender(<StreamingMarkdown>{'```ts\nconst answer = 42;\n```\n\nnext paragraph grows'}</StreamingMarkdown>);

    expect(markdownCalls).toEqual(['```ts\nconst answer = 42;\n```']);
    expect(screen.getByTestId('message-streaming-tail')).toHaveTextContent('next paragraph grows');
  });

  it('renders only the active tail as plain text when more than one settled block exists', () => {
    render(<StreamingMarkdown>{'one\n\n```ts\ntwo\n```\n\nthree'}</StreamingMarkdown>);

    expect(markdownCalls).toEqual(['one\n', '```ts\ntwo\n```']);
    expect(screen.getByTestId('message-streaming-tail')).toHaveTextContent('three');
  });
});
