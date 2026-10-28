import type { Session, WebContents } from 'electron';

type PermissionRequestDetails =
  | Electron.PermissionRequest
  | Electron.FilesystemPermissionRequest
  | Electron.MediaAccessPermissionRequest
  | Electron.OpenExternalPermissionRequest;
type PermissionCheckDetails = Electron.PermissionCheckHandlerHandlerDetails;

export type PermissionRequestContext = {
  webContents: WebContents;
  permission: string;
  details: PermissionRequestDetails;
};

export type PermissionCheckContext = {
  webContents: WebContents | null;
  permission: string;
  requestingOrigin: string;
  details: PermissionCheckDetails;
};

export type SessionPermissionPolicy = {
  allowRequest: (context: PermissionRequestContext) => boolean;
  allowCheck: (context: PermissionCheckContext) => boolean;
};

const DENY_ALL: SessionPermissionPolicy = {
  allowRequest: () => false,
  allowCheck: () => false,
};

const BROWSER_ALLOWED_CHECKS = new Set(['fullscreen']);

/**
 * External web pages keep fullscreen for video, but receive no camera,
 * microphone, location, notification, clipboard, screen-capture, MIDI, device,
 * or external-application permission.
 */
export const BROWSER_PERMISSION_POLICY: SessionPermissionPolicy = {
  allowRequest: () => false,
  allowCheck: ({ permission }) => BROWSER_ALLOWED_CHECKS.has(permission),
};

/** Local HTML and office previews need no browser permission at all. */
export const PREVIEW_PERMISSION_POLICY: SessionPermissionPolicy = DENY_ALL;

function trustedAppUrl(url: string, rendererUrl: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (rendererUrl) return parsed.origin === new URL(rendererUrl).origin;
    return parsed.protocol === 'file:';
  } catch {
    return false;
  }
}

/**
 * The app renderer may use clipboard reads and writes and the Local Font Access API.
 * `unknown` is how Electron 37 reports `local-fonts`; it is accepted only from
 * the renderer's main frame itself, while every other unknown request is denied.
 */
export function appRendererPermissionPolicy(rendererUrl: string | undefined): SessionPermissionPolicy {
  const trustedMainFrame = (url: string | undefined, isMainFrame: boolean): boolean =>
    isMainFrame && Boolean(url) && trustedAppUrl(url as string, rendererUrl);

  return {
    allowRequest: ({ permission, details }) => {
      if (!trustedMainFrame(details.requestingUrl, details.isMainFrame)) return false;
      return (
        permission === 'clipboard-read' ||
        permission === 'clipboard-sanitized-write' ||
        permission === 'local-fonts' ||
        permission === 'unknown'
      );
    },
    allowCheck: ({ permission, requestingOrigin, details }) => {
      if (!trustedMainFrame(requestingOrigin, details.isMainFrame)) return false;
      return permission === 'clipboard-read' || permission === 'clipboard-sanitized-write';
    },
  };
}

/**
 * Installs all permission hooks Electron consults. A request handler alone
 * leaves APIs that only perform permission checks undecided, and screen capture
 * can bypass the request handler through setDisplayMediaRequestHandler.
 */
export function installSessionPermissionPolicy(target: Session, policy: SessionPermissionPolicy): void {
  target.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(policy.allowRequest({ webContents, permission, details }));
  });
  target.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return policy.allowCheck({ webContents, permission, requestingOrigin, details });
  });
  target.setDevicePermissionHandler(() => false);
  target.setDisplayMediaRequestHandler((_request, callback) => callback({}));
}
