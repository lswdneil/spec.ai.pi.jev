import { describe, expect, it, vi } from 'vitest';
import type { Session, WebContents } from 'electron';
import {
  appRendererPermissionPolicy,
  BROWSER_PERMISSION_POLICY,
  installSessionPermissionPolicy,
  PREVIEW_PERMISSION_POLICY,
} from '@/process/security/sessionPermissions';

type RequestHandler = NonNullable<Parameters<Session['setPermissionRequestHandler']>[0]>;
type CheckHandler = NonNullable<Parameters<Session['setPermissionCheckHandler']>[0]>;
type DeviceHandler = NonNullable<Parameters<Session['setDevicePermissionHandler']>[0]>;
type DisplayHandler = NonNullable<Parameters<Session['setDisplayMediaRequestHandler']>[0]>;

function fakeSession() {
  let request: RequestHandler | null = null;
  let check: CheckHandler | null = null;
  let device: DeviceHandler | null = null;
  let display: DisplayHandler | null = null;
  const session = {
    setPermissionRequestHandler: vi.fn((handler: RequestHandler | null) => {
      request = handler;
    }),
    setPermissionCheckHandler: vi.fn((handler: CheckHandler | null) => {
      check = handler;
    }),
    setDevicePermissionHandler: vi.fn((handler: DeviceHandler | null) => {
      device = handler;
    }),
    setDisplayMediaRequestHandler: vi.fn((handler: DisplayHandler | null) => {
      display = handler;
    }),
  } as unknown as Session;
  return {
    session,
    request: (...args: Parameters<RequestHandler>) => request?.(...args),
    check: (...args: Parameters<CheckHandler>) => check?.(...args),
    device: (...args: Parameters<DeviceHandler>) => device?.(...args),
    display: (...args: Parameters<DisplayHandler>) => display?.(...args),
  };
}

const contents = {} as WebContents;
const requestDetails = (requestingUrl: string, isMainFrame = true) => ({ requestingUrl, isMainFrame });
const checkDetails = (isMainFrame = true) => ({ isMainFrame });

describe('session permission policies', () => {
  it('installs request, check, device, and display handlers for a browser partition', () => {
    const browser = fakeSession();
    installSessionPermissionPolicy(browser.session, BROWSER_PERMISSION_POLICY);
    expect(browser.session.setPermissionRequestHandler).toHaveBeenCalledOnce();
    expect(browser.session.setPermissionCheckHandler).toHaveBeenCalledOnce();
    expect(browser.session.setDevicePermissionHandler).toHaveBeenCalledOnce();
    expect(browser.session.setDisplayMediaRequestHandler).toHaveBeenCalledOnce();

    for (const permission of [
      'media',
      'geolocation',
      'notifications',
      'clipboard-read',
      'clipboard-sanitized-write',
      'display-capture',
      'midi',
      'openExternal',
      'fileSystem',
    ]) {
      const callback = vi.fn();
      browser.request(contents, permission, callback, requestDetails('https://example.com'));
      expect(callback).toHaveBeenCalledWith(false);
      expect(browser.check(contents, permission, 'https://example.com', checkDetails())).toBe(false);
    }
    expect(browser.check(contents, 'fullscreen', 'https://example.com', checkDetails())).toBe(true);
    expect(browser.device({ deviceType: 'usb', origin: 'https://example.com', device: {} } as never)).toBe(false);

    const mediaCallback = vi.fn();
    browser.display({} as never, mediaCallback);
    expect(mediaCallback).toHaveBeenCalledWith({});
  });

  it('denies every permission on a preview session', () => {
    const preview = fakeSession();
    installSessionPermissionPolicy(preview.session, PREVIEW_PERMISSION_POLICY);
    const callback = vi.fn();
    preview.request(contents, 'media', callback, requestDetails('file:///tmp/preview.html'));
    expect(callback).toHaveBeenCalledWith(false);
    expect(preview.check(contents, 'clipboard-read', 'file://', checkDetails())).toBe(false);

    const displayCallback = vi.fn();
    preview.display({} as never, displayCallback);
    expect(displayCallback).toHaveBeenCalledWith({});
  });

  it('allows only trusted main-frame local fonts and clipboard writes in the app renderer', () => {
    const app = fakeSession();
    installSessionPermissionPolicy(app.session, appRendererPermissionPolicy('http://localhost:5173/'));

    const fontCallback = vi.fn();
    app.request(contents, 'unknown', fontCallback, requestDetails('http://localhost:5173/'));
    expect(fontCallback).toHaveBeenCalledWith(true);

    const clipboardCallback = vi.fn();
    app.request(contents, 'clipboard-sanitized-write', clipboardCallback, requestDetails('http://localhost:5173/'));
    expect(clipboardCallback).toHaveBeenCalledWith(true);
    const clipboardReadCallback = vi.fn();
    app.request(contents, 'clipboard-read', clipboardReadCallback, requestDetails('http://localhost:5173/'));
    expect(clipboardReadCallback).toHaveBeenCalledWith(true);
    expect(app.check(contents, 'clipboard-read', 'http://localhost:5173', checkDetails())).toBe(true);
    expect(app.check(contents, 'clipboard-sanitized-write', 'http://localhost:5173', checkDetails())).toBe(true);

    for (const permission of ['media', 'geolocation', 'notifications', 'display-capture']) {
      const callback = vi.fn();
      app.request(contents, permission, callback, requestDetails('http://localhost:5173/'));
      expect(callback).toHaveBeenCalledWith(false);
      expect(app.check(contents, permission, 'http://localhost:5173', checkDetails())).toBe(false);
    }

    const foreignCallback = vi.fn();
    app.request(contents, 'unknown', foreignCallback, requestDetails('https://example.com'));
    expect(foreignCallback).toHaveBeenCalledWith(false);

    const iframeCallback = vi.fn();
    app.request(contents, 'clipboard-sanitized-write', iframeCallback, requestDetails('http://localhost:5173/', false));
    expect(iframeCallback).toHaveBeenCalledWith(false);

    const displayCallback = vi.fn();
    app.display({} as never, displayCallback);
    expect(displayCallback).toHaveBeenCalledWith({});
  });
});
