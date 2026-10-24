import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadWebUiExtensionViews } from './extensions.js';
import { startStaticServer, type StaticServerHandle, type WebUiAccess } from './static-server.js';

const work: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'ws-extension-'));
  work.push(root);
  mkdirSync(join(root, 'assets'));
  mkdirSync(join(root, 'webui'));
  writeFileSync(join(root, 'assets', 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  writeFileSync(
    join(root, 'webui', 'handler.js'),
    'module.exports = async (req, res) => { res.json({ ok: true, method: req.method, body: req.body ?? null }); };\n'
  );
  writeFileSync(
    join(root, 'aion-extension.json'),
    JSON.stringify({
      name: 'ext-demo',
      contributes: {
        webui: {
          apiRoutes: [{ path: '/ext-demo/stats', entryPoint: 'webui/handler.js', auth: true }],
          staticAssets: [{ urlPrefix: '/ext-demo/assets', directory: 'assets' }],
        },
      },
    })
  );
  return root;
}

async function backend(extensionRoot: string): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const send = (data: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: true, data }));
    };
    if (req.url === '/api/extensions') return send([{ name: 'ext-demo', enabled: true }]);
    if (req.url === '/api/extensions/webui') {
      return send([
        {
          extension_name: 'ext-demo',
          directory: extensionRoot,
          routes: [{ path: '/ext-demo/stats', method: 'GET', handler: 'webui/handler.js' }],
        },
        { extension_name: 'ext-demo', directory: join(extensionRoot, 'assets') },
      ]);
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  return { port, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

afterEach(() => {
  for (const dir of work.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('extension WebUI host', () => {
  it('exposes manifest auth and asset prefixes through the contribution view', async () => {
    const root = fixture();
    const api = await backend(root);
    try {
      expect(await loadWebUiExtensionViews(api.port)).toEqual([
        {
          extensionName: 'ext-demo',
          apiRoutes: [{ path: '/ext-demo/stats', auth: true }],
          staticAssets: [{ urlPrefix: '/ext-demo/assets', directory: join(root, 'assets') }],
        },
      ]);
    } finally {
      await api.close();
    }
  });

  it('serves extension assets publicly and gates handlers by device scope', async () => {
    const root = fixture();
    const api = await backend(root);
    let handle: StaticServerHandle | null = null;
    const access: WebUiAccess = {
      verify: (cookie) => {
        if (cookie === 'specjev_device=control') return { deviceId: 'd1', scope: 'control' };
        if (cookie === 'specjev_device=read') return { deviceId: 'd2', scope: 'read' };
        return null;
      },
      handlePublicRequest: async () => true,
    };
    try {
      handle = await startStaticServer({
        staticDir: root,
        backendPort: api.port,
        port: 0,
        access,
        extensions: true,
      });
      const base = handle.localUrl;

      const asset = await fetch(`${base}/ext-demo/assets/icon.svg`);
      expect(asset.status).toBe(200);
      expect(asset.headers.get('content-type')).toContain('image/svg');

      const unpaired = await fetch(`${base}/ext-demo/stats`);
      expect(unpaired.status).toBe(403);

      const control = await fetch(`${base}/ext-demo/stats`, {
        headers: { cookie: 'specjev_device=control' },
      });
      expect(control.status).toBe(200);
      expect(await control.json()).toEqual({ ok: true, method: 'GET', body: null });

      const handler = join(root, 'webui', 'handler.js');
      writeFileSync(handler, 'module.exports = async (req, res) => { res.json({ version: 2 }); };\n');
      const future = new Date(Date.now() + 5_000);
      utimesSync(handler, future, future);
      const reloaded = await fetch(`${base}/ext-demo/stats`, {
        headers: { cookie: 'specjev_device=control' },
      });
      expect(await reloaded.json()).toEqual({ version: 2 });

      const readPost = await fetch(`${base}/ext-demo/stats`, {
        method: 'POST',
        headers: { cookie: 'specjev_device=read', 'content-type': 'application/json' },
        body: JSON.stringify({ hello: 'world' }),
      });
      expect(readPost.status).toBe(403);
      expect(await readPost.json()).toEqual({ error: 'READ_ONLY_DEVICE' });
    } finally {
      await handle?.stop();
      await api.close();
    }
  });
});
