import { kyrnBridge } from '@/common/kyrn/bridge';
import { kyrnFolderBridge } from '@/common/kyrn/folderBridge';
import { isElectronDesktop } from './platform';

type Result = { ok: true; data: unknown } | { ok: false; error: string; code?: string };

type Invokable = { invoke: (params?: unknown) => Promise<unknown> };

const REMOTE_METHODS = [
  'settings',
  'save',
  'availableModels',
  'defaultModel',
  'setDefaultModel',
  'recheck',
  'testProvider',
  'loginStart',
  'loginState',
  'loginAnswer',
  'loginCancel',
  'loginStatus',
  'loginLogout',
  'localJudgeState',
  'localJudgeRun',
  'clmCheck',
  'activity',
  'modelLevels',
  'lessons',
  'lessonsChange',
  'importList',
  'importRun',
  'importHistory',
  'skills',
  'skillAdd',
  'skillRemove',
  'mcpServers',
  'mcpAdd',
  'mcpRemove',
  'mcpSwitch',
  'capabilityReveal',
] as const;

const FOLDER_METHODS = ['lessons', 'lessonsChange', 'files'] as const;

const loopback = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const fail = (error: string): Result => ({ ok: false, code: 'runtimeOffline', error });

function hostUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const search = window.location.search;
  const hash = window.location.hash;
  const hashQuery = hash.includes('?') ? new URLSearchParams(hash.slice(hash.indexOf('?') + 1)) : null;
  const query = new URLSearchParams(search).get('kyrnHost') ?? hashQuery?.get('kyrnHost');
  if (query) {
    try {
      const parsed = new URL(query);
      if (parsed.protocol === 'wss:') return parsed.toString();
      if (parsed.protocol === 'ws:' && loopback.has(parsed.hostname)) return parsed.toString();
    } catch {
      // Fall through to the same-origin path.
    }
  }

  // A `wss://` link may survive in sessionStorage after the query is gone. A
  // loopback link must not: the same-origin proxy is now the normal path, and a
  // stale token would bypass it.
  const stored = (() => {
    try {
      return sessionStorage.getItem('specjev.kyrnHost');
    } catch {
      return null;
    }
  })();
  if (stored) {
    try {
      const parsed = new URL(stored);
      if (parsed.protocol === 'wss:') return parsed.toString();
    } catch {
      // Ignore malformed storage.
    }
  }

  // The web-host proxies `/kyrn` to the loopback KyRN host and rewrites the
  // token in-process. A browser served by it can therefore use its own origin:
  // no secret in the address bar, and the same URL works through an HTTPS
  // reverse proxy. Electron has a real main process and must not install these
  // overrides.
  if (isElectronDesktop()) return null;
  if (typeof window === 'undefined') return null;
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return null;
  if (!window.location.host) return null;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/kyrn`;
}

/**
 * The WebUI has no Electron main process. When the desktop app has offered a KyRN host, forward the
 * providers that own local files, keys, or child processes to it. The URL is a pairing link: loopback
 * `ws://` is accepted; a remote host must be `wss://`.
 */
export function installKyrnHostClient(): void {
  // The Electron renderer already reaches the real providers through its
  // preload bridge; never shadow them with a WebSocket client.
  if (isElectronDesktop()) return;

  const url = hostUrl();
  if (!url) return;

  try {
    sessionStorage.setItem('specjev.kyrnHost', url);
  } catch {
    // Storage is optional; the query link still works for this page.
  }

  let socket: WebSocket | null = null;
  let nextId = 0;
  const pending = new Map<string, { resolve: (value: Result) => void; timer: number }>();

  const connect = (): void => {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    socket = new WebSocket(url);
    socket.addEventListener('message', (event) => {
      try {
        const frame = JSON.parse(event.data as string) as { id?: unknown; result?: unknown; error?: unknown };
        if (typeof frame.id !== 'string') return;
        const request = pending.get(frame.id);
        if (!request) return;
        pending.delete(frame.id);
        window.clearTimeout(request.timer);
        if (typeof frame.error === 'string') request.resolve(fail(frame.error));
        else request.resolve(frame.result as Result);
      } catch {
        // Ignore malformed frames; the request timeout answers.
      }
    });
    socket.addEventListener('close', () => {
      for (const [id, request] of pending) {
        window.clearTimeout(request.timer);
        pending.delete(id);
        request.resolve(fail('The desktop app closed the KyRN host connection'));
      }
    });
  };

  const request = (name: string, data: unknown): Promise<Result> =>
    new Promise((resolve) => {
      connect();
      const id = `kyrn-host-${++nextId}`;
      const timer = window.setTimeout(() => {
        pending.delete(id);
        resolve(fail('The desktop app did not answer the KyRN request'));
      }, 30_000);
      pending.set(id, { resolve, timer });
      const send = () => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ id, name, data }));
        } else {
          socket?.addEventListener('open', send, { once: true });
        }
      };
      send();
    });

  const install = (target: Record<string, Invokable>, method: string, wireName: string): void => {
    const entry = target[method];
    if (!entry) return;
    entry.invoke = ((data?: unknown) => request(wireName, data)) as Invokable['invoke'];
  };

  const bridge = kyrnBridge as unknown as Record<string, Invokable>;
  for (const method of REMOTE_METHODS) install(bridge, method, `kyrn.${method}`);

  const folders = kyrnFolderBridge as unknown as Record<string, Invokable>;
  for (const method of FOLDER_METHODS) install(folders, method, `kyrn.folder.${method}`);
}
