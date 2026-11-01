/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import React from 'react';

const writeRendererLogInvoke = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      getImageBase64: { invoke: vi.fn(() => Promise.resolve('')) },
      readFile: { invoke: vi.fn(() => Promise.resolve('')) },
    },
    application: {
      writeRendererLog: { invoke: writeRendererLogInvoke },
    },
  },
}));

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => <div data-testid='monaco-editor'>{value}</div>,
}));

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

import HTMLViewer from '@/renderer/pages/conversation/Preview/components/viewers/HTMLViewer';
import HTMLRenderer from '@/renderer/pages/conversation/Preview/components/renderers/HTMLRenderer';
import PDFViewer from '@/renderer/pages/conversation/Preview/components/viewers/PDFViewer';
import { PREVIEW_SESSION_PARTITION } from '@/common/config/constants';

function createConsoleMessageEvent({
  level,
  line,
  message,
  sourceId,
}: {
  level: number;
  line: number;
  message: string;
  sourceId: string;
}): Event {
  const event = new Event('console-message');
  Object.defineProperties(event, {
    level: { value: level },
    line: { value: line },
    message: { value: message },
    sourceId: { value: sourceId },
  });
  return event;
}

describe('HTMLViewer', () => {
  it('renders iframe with HTML content', () => {
    const { container } = render(<HTMLViewer content='<h1>Test</h1>' />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
  });

  it('hides toolbar when hideToolbar is true', () => {
    const { container } = render(<HTMLViewer content='<h1>Test</h1>' hideToolbar />);
    expect(container.querySelector('[class*="toolbar"]')).not.toBeInTheDocument();
  });

  it('accepts file_path prop', () => {
    const { container } = render(<HTMLViewer content='<h1>Test</h1>' file_path='/test/index.html' />);
    expect(container.querySelector('iframe')).toBeInTheDocument();
  });
});

describe('PDFViewer', () => {
  it('loads PDF content in the isolated preview session', async () => {
    const { container } = render(<PDFViewer content='data:application/pdf;base64,AA==' />);
    const webview = await waitFor(() => {
      const element = container.querySelector('webview');
      expect(element).toBeInTheDocument();
      return element;
    });

    expect(webview?.getAttribute('partition')).toBe(PREVIEW_SESSION_PARTITION);
  });
});

describe('HTMLRenderer', () => {
  const electronAPI = {};

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
    vi.clearAllMocks();
  });

  it('sandboxes browser HTML without granting same-origin access', () => {
    Reflect.deleteProperty(window, 'electronAPI');
    const { container } = render(<HTMLRenderer content='<script>parent.document.body.remove()</script>' />);
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.getAttribute('sandbox')).toContain('allow-scripts');
    expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
  });

  it('waits for streamed HTML to settle before remounting the preview', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<HTMLRenderer content='<p>first</p>' />);
      const iframe = container.querySelector('iframe');
      const firstSrc = iframe?.getAttribute('srcdoc');
      expect(firstSrc).toContain('first');

      rerender(<HTMLRenderer content='<p>second</p>' />);
      expect(iframe?.getAttribute('srcdoc')).toBe(firstSrc);

      act(() => vi.advanceTimersByTime(149));
      expect(iframe?.getAttribute('srcdoc')).toBe(firstSrc);

      act(() => vi.advanceTimersByTime(1));
      expect(iframe?.getAttribute('srcdoc')).toContain('second');
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads clean local HTML files through file URL in Electron', () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: electronAPI,
    });

    const { container } = render(
      <HTMLRenderer
        content='<script src="https://cdn.example.com/app.js"></script><script>localStorage.getItem("theme")</script>'
        file_path='/workspace/financial-wechat-miniapp.html'
      />
    );

    const webview = container.querySelector('webview');
    expect(webview).toBeInTheDocument();
    expect(webview?.getAttribute('src')).toBe('file:///workspace/financial-wechat-miniapp.html');
    expect(webview?.getAttribute('partition')).toBe(PREVIEW_SESSION_PARTITION);
  });

  it('keeps dirty local HTML content in memory in Electron', () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: electronAPI,
    });

    const dirtyProps = {
      content: '<h1>Unsaved edit</h1>',
      file_path: '/workspace/index.html',
      isDirty: true,
    } as React.ComponentProps<typeof HTMLRenderer> & { isDirty: boolean };

    const { container } = render(<HTMLRenderer {...dirtyProps} />);

    const webview = container.querySelector('webview');
    expect(webview).toBeInTheDocument();
    expect(webview?.getAttribute('src')).toContain('data:text/html');
    expect(webview?.getAttribute('src')).toContain('Unsaved%20edit');
  });

  it('writes preview source selection to the renderer log bridge', async () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: electronAPI,
    });

    render(<HTMLRenderer content='<h1>Test</h1>' file_path='/workspace/financial-wechat-miniapp.html' />);

    await waitFor(() =>
      expect(writeRendererLogInvoke).toHaveBeenCalledWith({
        level: 'info',
        tag: 'HTMLRenderer',
        message: 'html_preview_source_selected',
        data: expect.objectContaining({
          source: 'file',
          reason: 'clean-local-file',
          fileName: 'financial-wechat-miniapp.html',
          hasFilePath: true,
          contentLength: 13,
          src: 'file://financial-wechat-miniapp.html',
        }),
      })
    );
  });

  it('writes level 2 preview console messages as renderer warnings', async () => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: electronAPI,
    });

    const { container } = render(<HTMLRenderer content='<h1>Test</h1>' file_path='/workspace/index.html' />);
    const webview = container.querySelector('webview');

    await waitFor(() => expect(writeRendererLogInvoke).toHaveBeenCalled());
    vi.clearAllMocks();

    webview?.dispatchEvent(
      createConsoleMessageEvent({
        level: 2,
        line: 64,
        message: 'cdn.tailwindcss.com should not be used in production.',
        sourceId: 'https://cdn.tailwindcss.com/',
      })
    );

    await waitFor(() =>
      expect(writeRendererLogInvoke).toHaveBeenCalledWith({
        level: 'warn',
        tag: 'HTMLRenderer',
        message: 'html_preview_console_warning',
        data: {
          level: 2,
          line: 64,
          message: 'cdn.tailwindcss.com should not be used in production.',
          source: 'https://cdn.tailwindcss.com/',
        },
      })
    );
  });
});
