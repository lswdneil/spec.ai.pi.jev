/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { join } from 'node:path';
import type { BrowserWindow } from 'electron';
import { app, session } from 'electron';
import {
  loadWebUiExtensionViews,
  renderPairingPage,
  startStaticServer,
  type StaticServerHandle,
  type WebUiAccess,
} from '@mu/web-host';
import { ipcBridge } from '@/common';
import { normalizeWebUiPublicUrl } from '@/common/webui/scopes';
import { WebUiAccessManager } from '@process/services/webui/access';
import { handlePairingRequest } from '@process/services/webui/pairingHttp';
import { BROWSER_SESSION_PARTITION, WEBUI_ENABLED_IN_RELEASE } from '@/common/config/constants';
import { ProcessConfig } from '@process/utils/initStorage';
import { getZoomFactor, setZoomFactor } from '@process/utils/zoom';
import { getCdpStatus, updateCdpConfig } from '@process/utils/configureChromium';
import { getCdpBridgeHandle } from '@process/utils/cdpBridgeRegistry';
import { getGpuStatus, setGpuUserOverride } from '@process/utils/gpuRecovery';
import { initApplicationBridgeCore } from './applicationBridgeCore';
import type { IStartOnBootStatus, IWebUiStatus } from '@/common/adapter/ipcBridge';
import { restartApplication } from './restartApplication';

let mainWindowRef: BrowserWindow | null = null;
let webUi: { handle: StaticServerHandle; url: string; port: number } | null = null;
let webUiStarting: Promise<IWebUiStatus> | null = null;
let webUiEpoch = 0;
let webUiAccess: WebUiAccessManager | null = null;

function getWebUiAccess(): WebUiAccessManager {
  if (!webUiAccess) {
    const dataDir = app.getPath('userData');
    webUiAccess = new WebUiAccessManager({
      storePath: join(dataDir, 'webui-devices.json'),
      auditPath: join(dataDir, 'webui-audit.jsonl'),
    });
  }
  return webUiAccess;
}

const webUiAccessAdapter: WebUiAccess = {
  verify: (cookieHeader) => getWebUiAccess().verifyCookie(cookieHeader),
  handlePublicRequest: (request, response) => handlePairingRequest(getWebUiAccess(), request, response),
  onRevoke: (listener) => getWebUiAccess().onRevoke(listener),
};

function webUiStatus(error?: string): IWebUiStatus {
  return webUi ? { running: true, port: webUi.port, url: webUi.url } : { running: false, ...(error ? { error } : {}) };
}

async function startWebUi(port?: number, persist = true): Promise<IWebUiStatus> {
  if (!WEBUI_ENABLED_IN_RELEASE && app.isPackaged) {
    return { running: false, error: 'Remote access is not available in this release' };
  }
  if (webUi) return webUiStatus();
  if (webUiStarting) return webUiStarting;

  const backendPort = (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort;
  if (!backendPort) return { running: false, error: 'The local backend is not ready' };

  const epoch = ++webUiEpoch;
  webUiStarting = (async (): Promise<IWebUiStatus> => {
    try {
      // Keep a stable port so a reverse-proxy config survives a restart. If the
      // default is taken (another instance, or an unrelated process), fall back
      // to an ephemeral port rather than refusing remote access.
      const candidates = port === undefined ? [undefined, 0] : [port];
      let lastError: unknown;
      for (const candidate of candidates) {
        try {
          const handle = await startStaticServer({
            staticDir: join(app.getAppPath(), 'out', 'renderer'),
            backendPort,
            port: candidate,
            // The reverse proxy is the only listener that should cross the machine boundary.
            allowRemote: false,
            kyrnHostUrl: (globalThis as typeof globalThis & { __kyrnHostUrl?: string }).__kyrnHostUrl,
            access: webUiAccessAdapter,
            pairingPage: renderPairingPage,
            extensions: true,
          });
          if (epoch !== webUiEpoch) {
            // The user turned the switch off while the listener was starting.
            await handle.stop();
            return webUiStatus();
          }
          webUi = { handle, url: handle.localUrl, port: handle.port };
          getWebUiAccess().beginSession();
          if (persist) {
            await ProcessConfig.set('system.webuiEnabled', true).catch((): undefined => undefined);
          }
          return webUiStatus();
        } catch (error) {
          lastError = error;
        }
      }
      return { running: false, error: lastError instanceof Error ? lastError.message : String(lastError) };
    } finally {
      // A completed start must not answer the next start with a cached handle.
      webUiStarting = null;
    }
  })();

  return webUiStarting;
}

async function stopWebUi(persist = true): Promise<IWebUiStatus> {
  webUiEpoch += 1;
  const current = webUi;
  webUi = null;
  webUiAccess?.endSession();
  if (current) await current.handle.stop().catch((): undefined => undefined);
  if (persist) {
    await ProcessConfig.set('system.webuiEnabled', false).catch((): undefined => undefined);
  }
  return webUiStatus();
}

/**
 * Called once the backend is ready. The Remote access switch writes
 * `system.webuiEnabled`; a launch with it on brings the listener back without
 * opening Settings.
 */
export async function startWebUiIfEnabled(): Promise<void> {
  // 0.1.x keeps the WebUI code but does not expose it. A switch left on by an
  // earlier build must not bring the listener back without a visible control.
  if (!WEBUI_ENABLED_IN_RELEASE) return;
  if (webUi || webUiStarting) return;
  const enabled = await ProcessConfig.get('system.webuiEnabled').catch((): undefined => undefined);
  if (!enabled) return;
  const status = await startWebUi(undefined, false);
  if (status.error) console.warn('[spec.jev] WebUI service did not start:', status.error);
}

const START_ON_BOOT_UNSUPPORTED_MESSAGE = 'Start on boot is only available in packaged macOS and Windows apps.';
/** Failure code the settings page maps to its translated text (settings.startOnBootUnsupported). */
export const START_ON_BOOT_UNSUPPORTED_CODE = 'startOnBootUnsupported';
export const START_ON_BOOT_WINDOWS_ARG = '--start-on-boot';

const isStartOnBootSupported = (): boolean => {
  return app.isPackaged && (process.platform === 'darwin' || process.platform === 'win32');
};

const getStartOnBootWindowsArgs = (): string[] => [START_ON_BOOT_WINDOWS_ARG];

const getLoginItemSettings = () => {
  return process.platform === 'win32'
    ? app.getLoginItemSettings({ args: getStartOnBootWindowsArgs() })
    : app.getLoginItemSettings();
};

export function wasLaunchedAtLogin(): boolean {
  if (!app.isPackaged) {
    return false;
  }

  if (process.platform === 'darwin') {
    return Boolean(getLoginItemSettings().wasOpenedAtLogin);
  }

  if (process.platform === 'win32') {
    return process.argv.includes(START_ON_BOOT_WINDOWS_ARG);
  }

  return false;
}

export function getStartOnBootStatus(): IStartOnBootStatus {
  if (!isStartOnBootSupported()) {
    return {
      supported: false,
      enabled: false,
      isPackaged: app.isPackaged,
      platform: process.platform,
    };
  }

  const settings = getLoginItemSettings();
  const enabled =
    process.platform === 'win32'
      ? Boolean(settings.openAtLogin || settings.executableWillLaunchAtLogin)
      : Boolean(settings.openAtLogin);

  return {
    supported: true,
    enabled,
    isPackaged: app.isPackaged,
    platform: process.platform,
  };
}

export function setStartOnBootEnabled(enabled: boolean): IStartOnBootStatus {
  const currentStatus = getStartOnBootStatus();
  if (!currentStatus.supported) {
    return currentStatus;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    ...(process.platform === 'win32'
      ? {
          args: getStartOnBootWindowsArgs(),
          enabled: true,
        }
      : {}),
  });

  return getStartOnBootStatus();
}

export function setApplicationMainWindow(win: BrowserWindow): void {
  mainWindowRef = win;
}

export function initApplicationBridge(): void {
  // Platform-agnostic handlers: systemInfo, updateSystemInfo, getPath
  initApplicationBridgeCore();

  ipcBridge.application.restart.provider(async () => {
    // Backend subprocess shutdown is handled by backendManager.stop() in the
    // main window's before-quit hook; agent children are killed transitively
    // when backend exits.
    return restartApplication(app);
  });

  ipcBridge.application.isDevToolsOpened.provider(() => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      return Promise.resolve(mainWindowRef.webContents.isDevToolsOpened());
    }
    return Promise.resolve(false);
  });

  ipcBridge.application.openDevTools.provider(() => {
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      const win = mainWindowRef;
      const wasOpen = win.webContents.isDevToolsOpened();

      if (wasOpen) {
        win.webContents.closeDevTools();
        return Promise.resolve(false);
      } else {
        return new Promise((resolve) => {
          const onOpened = () => {
            win.webContents.off('devtools-opened', onOpened);
            resolve(true);
          };

          win.webContents.once('devtools-opened', onOpened);
          win.webContents.openDevTools();

          setTimeout(() => {
            win.webContents.off('devtools-opened', onOpened);
            if (win.isDestroyed()) {
              resolve(false);
              return;
            }
            resolve(win.webContents.isDevToolsOpened());
          }, 500);
        });
      }
    }
    return Promise.resolve(false);
  });

  ipcBridge.application.getZoomFactor.provider(() => Promise.resolve(getZoomFactor()));

  ipcBridge.application.setZoomFactor.provider(async ({ factor }) => {
    const updatedFactor = setZoomFactor(factor);
    try {
      await ProcessConfig.set('ui.zoomFactor', updatedFactor);
    } catch (error) {
      console.error('[ApplicationBridge] Failed to persist zoom factor:', error);
    }
    return updatedFactor;
  });

  ipcBridge.application.writeRendererLog.provider(async ({ level, tag, message, data }) => {
    const prefix = `[Renderer:${tag}] ${message}`;
    const args = data === undefined ? [prefix] : [prefix, data];
    if (level === 'error') {
      console.error(...args);
    } else if (level === 'warn') {
      console.warn(...args);
    } else if (level === 'debug') {
      console.debug(...args);
    } else {
      console.info(...args);
    }
  });

  // CDP status and configuration
  ipcBridge.application.getCdpStatus.provider(async () => {
    try {
      const status = getCdpStatus();
      // If port is set, CDP is considered enabled (verification is optional)
      return { success: true, data: status };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.updateCdpConfig.provider(async (config) => {
    try {
      const updatedConfig = updateCdpConfig(config);
      return { success: true, data: updatedConfig };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  /**
   * 清空应用内浏览器的登录态与缓存。
   *
   * 登录态是全局共享的（所有 tab、所有项目共用一个 partition），所以这里是唯一
   * 的"退出全部网站"入口。已打开的浏览器 tab 需要刷新后才会体现，这在设置项的
   * 说明文案里告诉用户。
   *
   * Clear the in-app browser's sign-in state and cache. Sign-in state is globally
   * shared (one partition across all tabs and projects), so this is the only way
   * to sign out everywhere. Already-open browser tabs reflect it after a reload,
   * which the settings copy tells the user.
   */
  ipcBridge.application.clearBrowserData.provider(async () => {
    try {
      const browserSession = session.fromPartition(BROWSER_SESSION_PARTITION);
      // clearStorageData 只清 cookie 和各类 storage，不含 HTTP 缓存和认证缓存 ——
      // 而设置里的文案承诺了「清理缓存」，所以三个都要清。
      //
      // clearStorageData covers cookies and storages but neither the HTTP cache nor
      // the HTTP auth cache, and the settings copy promises the cache is cleared.
      await browserSession.clearStorageData();
      await browserSession.clearCache();
      await browserSession.clearAuthCache();
      return { success: true };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcBridge.application.reportBrowserWebContentsId.provider(async ({ webContentsId }) => {
    /**
     * 把单目标 CDP 通道附加到侧边浏览器。
     *
     * 每次浏览器 tab 切换都会重报一次：通道同时只服务一个目标，切换即改附加对象，
     * 这样 Agent 操作的始终是用户当前看到的那个页面。多 tab 情况下这是刻意的取舍 ——
     * 与其同时暴露 10 个 webContents，不如只暴露活跃的那一个。
     *
     * Attaches the single-target CDP bridge to the in-app browser. Re-reported on every
     * browser tab switch: the bridge serves one target at a time, so switching re-points
     * it and the agent always drives the page the user is actually looking at. With
     * multiple tabs this is a deliberate trade-off — exposing only the active webContents
     * rather than all ten at once.
     */
    try {
      const handle = getCdpBridgeHandle();
      if (!handle) return { success: false, msg: 'Agent browser control is not enabled.' };
      const result = handle.attach(webContentsId);
      if (result.ok === false) return { success: false, msg: result.reason };
      return { success: true };
    } catch (e) {
      return { success: false, msg: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcBridge.application.getStartOnBootStatus.provider(async () => {
    try {
      return { success: true, data: getStartOnBootStatus() };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.setStartOnBoot.provider(async ({ enabled }) => {
    try {
      const status = setStartOnBootEnabled(enabled);
      if (!status.supported) {
        return {
          success: false,
          code: START_ON_BOOT_UNSUPPORTED_CODE,
          msg: START_ON_BOOT_UNSUPPORTED_MESSAGE,
          data: status,
        };
      }
      return { success: true, data: status };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.getGpuStatus.provider(async () => {
    try {
      return { success: true, data: getGpuStatus() };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.setGpuOverride.provider(async ({ override }) => {
    try {
      return { success: true, data: setGpuUserOverride(override) };
    } catch (e) {
      return { success: false, msg: e.message || e.toString() };
    }
  });

  ipcBridge.application.getWebUiStatus.provider(async () => ({ success: true, data: webUiStatus() }));
  ipcBridge.application.startWebUi.provider(async ({ port }) => {
    const status = await startWebUi(port);
    return status.error ? { success: false, msg: status.error, data: status } : { success: true, data: status };
  });
  ipcBridge.application.stopWebUi.provider(async () => ({ success: true, data: await stopWebUi() }));
  ipcBridge.extensions.getWebUiContributions.provider(async () => {
    const backendPort = (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort;
    if (!backendPort) return { success: false, msg: 'The local backend is not ready' };
    return { success: true, data: await loadWebUiExtensionViews(backendPort) };
  });
  ipcBridge.application.getWebUiAccess.provider(async () => ({
    success: true,
    data: getWebUiAccess().listState(),
  }));
  ipcBridge.application.rotateWebUiCode.provider(async () => ({
    success: true,
    data: getWebUiAccess().rotateCode(),
  }));
  ipcBridge.application.approveWebUiPairing.provider(async ({ id, scope }) => {
    const access = getWebUiAccess();
    const result = access.approve(id, scope);
    if (result.ok === false) return { success: false, msg: result.error, data: access.listState() };
    return { success: true, data: access.listState() };
  });
  ipcBridge.application.rejectWebUiPairing.provider(async ({ id }) => {
    const access = getWebUiAccess();
    access.reject(id);
    return { success: true, data: access.listState() };
  });
  ipcBridge.application.revokeWebUiDevice.provider(async ({ id }) => {
    const access = getWebUiAccess();
    const result = access.revoke(id);
    if (!result.ok) return { success: false, msg: 'device_not_found', data: access.listState() };
    return { success: true, data: access.listState() };
  });
  ipcBridge.application.rotateWebUiDeviceToken.provider(async ({ id }) => {
    const access = getWebUiAccess();
    const result = access.rotateDevice(id);
    if (result.ok === false) return { success: false, msg: result.error, data: access.listState() };
    return { success: true, data: access.listState() };
  });
  ipcBridge.application.getWebUiPublicUrl.provider(async () => ({
    success: true,
    data: (await ProcessConfig.get('system.webuiPublicUrl').catch((): undefined => undefined)) || null,
  }));
  ipcBridge.application.setWebUiPublicUrl.provider(async ({ url }) => {
    const normalized = normalizeWebUiPublicUrl(url);
    if (normalized.ok === false) return { success: false, msg: 'invalid_public_url' };
    if (normalized.value === null) {
      await ProcessConfig.remove('system.webuiPublicUrl').catch((): undefined => undefined);
    } else {
      await ProcessConfig.set('system.webuiPublicUrl', normalized.value).catch((): undefined => undefined);
    }
    return { success: true, data: normalized.value };
  });
  app.once('will-quit', () => {
    // Quitting is not the user turning the switch off; keep the preference.
    void stopWebUi(false);
  });
}
