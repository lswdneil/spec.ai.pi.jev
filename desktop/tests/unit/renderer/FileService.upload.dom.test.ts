/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isFileTooLargeError, uploadFileViaHttp, FileService } from '@/renderer/services/FileService';

const { trackUploadMock } = vi.hoisted(() => ({
  trackUploadMock: vi.fn(() => ({
    onProgress: vi.fn(),
    finish: vi.fn(),
    abort: vi.fn(),
  })),
}));

vi.mock('@/renderer/hooks/file/useUploadState', () => ({
  trackUpload: trackUploadMock,
}));

type XhrResponse = {
  status: number;
  statusText?: string;
  responseText: string;
};

class FakeXMLHttpRequest {
  static response: XhrResponse = { status: 200, responseText: '' };
  static instances: FakeXMLHttpRequest[] = [];

  status = 0;
  statusText = '';
  responseText = '';
  upload = { addEventListener: vi.fn() };
  open = vi.fn();
  abort = vi.fn(() => this.dispatch('abort'));

  private readonly listeners = new Map<string, Array<() => void>>();

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(): void {
    queueMicrotask(() => {
      this.status = FakeXMLHttpRequest.response.status;
      this.statusText = FakeXMLHttpRequest.response.statusText ?? '';
      this.responseText = FakeXMLHttpRequest.response.responseText;
      this.dispatch('load');
    });
  }

  private dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

function setXhrResponse(response: XhrResponse): void {
  FakeXMLHttpRequest.response = response;
}

describe('FileService upload errors', () => {
  beforeEach(() => {
    FakeXMLHttpRequest.instances = [];
    setXhrResponse({ status: 200, responseText: '{"success":true,"data":"/tmp/upload.png"}' });
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest as unknown as typeof XMLHttpRequest);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves the managed path from a successful upload envelope', async () => {
    const path = await uploadFileViaHttp(new File(['image'], 'image.png', { type: 'image/png' }));
    expect(path).toBe('/tmp/upload.png');
  });

  it('preserves the backend error envelope instead of reducing it to a generic status message', async () => {
    setXhrResponse({
      status: 200,
      responseText: JSON.stringify({
        success: false,
        error: 'upload rejected by policy',
        code: 'UPLOAD_DENIED',
        details: { limit: 10 },
      }),
    });

    await expect(uploadFileViaHttp(new File(['image'], 'image.png'))).rejects.toMatchObject({
      name: 'BackendHttpError',
      status: 200,
      code: 'UPLOAD_DENIED',
      backendMessage: 'upload rejected by policy',
      details: { limit: 10 },
    });
  });

  it('recognizes an oversized upload from the HTTP status', async () => {
    setXhrResponse({ status: 413, statusText: 'Payload Too Large', responseText: '' });

    try {
      await uploadFileViaHttp(new File(['image'], 'image.png'));
      expect.fail('upload should fail');
    } catch (error) {
      expect(isFileTooLargeError(error)).toBe(true);
    }
  });

  it('propagates a dropped-file upload failure instead of silently skipping the file', async () => {
    setXhrResponse({
      status: 500,
      responseText: JSON.stringify({ success: false, error: 'disk unavailable', code: 'IO_ERROR' }),
    });
    const file = new File(['body'], 'notes.txt', { type: 'text/plain' });
    const files = Object.assign([file], {
      item: (index: number) => (index === 0 ? file : null),
    }) as unknown as FileList;

    await expect(FileService.processDroppedFiles(files)).rejects.toMatchObject({
      name: 'BackendHttpError',
      status: 500,
      code: 'IO_ERROR',
    });
  });
});
