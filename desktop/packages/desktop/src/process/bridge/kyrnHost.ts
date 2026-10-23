import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { app } from 'electron';
import { WebSocketServer, type WebSocket } from 'ws';
import { isKyrnMethodAllowed } from '../../common/kyrn/remoteScope';
import { invokeLocal } from '../../common/platform/bridge';
import type { WebUiDeviceScope } from '../../common/webui/scopes';
import { muHome } from '../agent/kyrn/naming';
import { pathCarriesToken } from '../services/muBrowser/protocol';

const HOST = '127.0.0.1';
const ADVERT_FILE = 'kyrn-host.json';

declare global {
  // The URL is loopback-only and carries the token. It is exposed to the app's own test harness,
  // never to a renderer or a window.
  var __kyrnHostUrl: string | undefined;
}

type HostRequest = {
  id?: unknown;
  name?: unknown;
  data?: unknown;
};

/**
 * A loopback socket for the browser half of spec.jev.
 *
 * The Electron main process already owns the KyRN providers (settings, activity, skills, MCP, local
 * judge, ...), which read local files and start local processes. A WebUI page must not grow a second
 * implementation of those. This host lets an authenticated local client call the same providers over
 * a token-gated WebSocket.
 *
 * This is the first slice: loopback only. A remote client still needs a pairing and TLS design before
 * it may use this URL.
 */
export function initKyrnHost(): void {
  void start().catch((error) => {
    console.warn('[spec.jev] KyRN host not offered:', error instanceof Error ? error.message : error);
  });
}

async function start(): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const sockets = new Set<WebSocket>();
  const http = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 * 1024 });

  http.on('upgrade', (request, socket, head) => {
    if (!pathCarriesToken(request.url, token)) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    const offeredScope = request.headers['x-specjev-scope'];
    const scope: WebUiDeviceScope = offeredScope === 'read' ? 'read' : 'control';
    wss.handleUpgrade(request, socket, head, (ws) => {
      sockets.add(ws);
      ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        void answer(ws, data.toString(), scope);
      });
      const end = () => sockets.delete(ws);
      ws.on('close', end);
      ws.on('error', end);
    });
  });

  const port = await new Promise<number>((resolve, reject) => {
    http.once('error', reject);
    http.listen(0, HOST, () => {
      const address = http.address();
      if (!address || typeof address === 'string') {
        reject(new Error('KyRN host has no port'));
        return;
      }
      resolve(address.port);
    });
  });

  const url = `ws://${HOST}:${port}/${token}`;
  const advert = join(muHome(), ADVERT_FILE);
  mkdirSync(muHome(), { recursive: true });
  writeFileSync(advert, JSON.stringify({ url, pid: process.pid }), 'utf8');
  globalThis.__kyrnHostUrl = url;

  app.once('will-quit', () => {
    if (globalThis.__kyrnHostUrl === url) delete globalThis.__kyrnHostUrl;
    rmSync(advert, { force: true });
    for (const ws of sockets) ws.terminate();
    sockets.clear();
    wss.close();
    http.close();
  });
}

async function answer(ws: WebSocket, raw: string, scope: WebUiDeviceScope): Promise<void> {
  let request: HostRequest;
  try {
    request = JSON.parse(raw) as HostRequest;
  } catch {
    ws.send(JSON.stringify({ error: 'Invalid JSON' }));
    return;
  }

  const id = typeof request.id === 'string' ? request.id : '';
  const name = typeof request.name === 'string' ? request.name : '';
  if (!id || !name.startsWith('kyrn.')) {
    ws.send(JSON.stringify({ id, error: 'Invalid KyRN request' }));
    return;
  }
  if (!isKyrnMethodAllowed(scope, name)) {
    ws.send(
      JSON.stringify({
        id,
        error: 'This device is read-only',
        code: 'permissionDenied',
      })
    );
    return;
  }

  try {
    const result = await invokeLocal(name, request.data);
    ws.send(JSON.stringify({ id, result }));
  } catch (error) {
    ws.send(
      JSON.stringify({
        id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
