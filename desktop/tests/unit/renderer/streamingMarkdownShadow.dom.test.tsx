import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const themeMocks = vi.hoisted(() => ({
  requestCurrent: vi.fn(async () => null),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    theme: {
      requestCurrent: { invoke: themeMocks.requestCurrent },
      changed: { on: () => () => undefined },
    },
  },
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('@/renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  useOptionalPreviewContext: () => undefined,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import StreamingMarkdown, { MAX_RICH_STREAM_BLOCKS } from '@/renderer/components/Markdown/StreamingMarkdown';

describe('StreamingMarkdown Shadow DOM', () => {
  it('uses one Shadow Root for a reply with hundreds of settled blocks', () => {
    const paragraphs = MAX_RICH_STREAM_BLOCKS + 50;
    const text = Array.from({ length: paragraphs }, (_, index) => `paragraph ${index}`).join('\n\n');
    const { container } = render(<StreamingMarkdown>{text}</StreamingMarkdown>);

    expect(container.querySelectorAll('.markdown-shadow')).toHaveLength(1);
    expect(themeMocks.requestCurrent).toHaveBeenCalledTimes(1);
  });
});
