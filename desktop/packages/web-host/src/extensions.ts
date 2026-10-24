import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { WebUiAccess } from './static-server.js';

type RawWebUiEntry = {
  extension_name?: unknown;
  directory?: unknown;
  routes?: Array<{ path?: unknown; method?: unknown; handler?: unknown }>;
};

type ManifestRoute = {
  path?: unknown;
  entryPoint?: unknown;
  auth?: unknown;
};

type ManifestStaticAsset = {
  urlPrefix?: unknown;
  directory?: unknown;
};

type ManifestWebUi = {
  apiRoutes?: ManifestRoute[];
  staticAssets?: ManifestStaticAsset[];
};

type Manifest = {
  contributes?: { webui?: ManifestWebUi };
};

export type WebUiExtensionRoute = {
  path: string;
  auth: boolean;
  handlerPath: string;
};

export type WebUiExtensionAsset = {
  urlPrefix: string;
  directory: string;
};

export type WebUiExtensionContribution = {
  extensionName: string;
  apiRoutes: WebUiExtensionRoute[];
  staticAssets: WebUiExtensionAsset[];
};

export type WebUiExtensionContributionView = {
  extensionName: string;
  apiRoutes: Array<{ path: string; auth: boolean }>;
  staticAssets: Array<{ urlPrefix: string; directory: string }>;
};

const requireFromHere = createRequire(import.meta.url);
const handlers = new Map<string, ((req: IncomingMessage, res: ServerResponse) => unknown) | null>();
const MAX_BODY = 2 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

type JsonResponse = ServerResponse & {
  status: (code: number) => JsonResponse;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
};

type JsonRequest = IncomingMessage & { body?: unknown };

async function fetchData<T>(port: number, path: string): Promise<T | null> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function findManifest(entries: RawWebUiEntry[]): { root: string; manifest: Manifest } | null {
  const directories = [...new Set(entries.map((entry) => stringValue(entry.directory)).filter(Boolean))] as string[];
  for (const directory of directories) {
    for (const candidate of [directory, dirname(directory)]) {
      const file = join(candidate, 'aion-extension.json');
      if (!existsSync(file)) continue;
      try {
        return { root: candidate, manifest: JSON.parse(readFileSync(file, 'utf8')) as Manifest };
      } catch {
        // A broken manifest disables only this extension's WebUI contributions.
      }
    }
  }
  return null;
}

function within(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolveManifestFile(root: string, value: unknown): string | null {
  const rel = stringValue(value);
  if (!rel) return null;
  const file = resolve(root, rel);
  return within(resolve(root), file) ? file : null;
}

function contributionFor(name: string, entries: RawWebUiEntry[], enabled: Set<string>): WebUiExtensionContribution | null {
  if (!enabled.has(name)) return null;
  const manifestHit = findManifest(entries);
  const root = manifestHit?.root;
  const webui = manifestHit?.manifest.contributes?.webui;

  const routes: WebUiExtensionRoute[] = [];
  if (webui?.apiRoutes && root) {
    for (const route of webui.apiRoutes) {
      const path = stringValue(route.path);
      const handlerPath = resolveManifestFile(root, route.entryPoint);
      if (!path || !handlerPath) continue;
      routes.push({ path, auth: typeof route.auth === 'boolean' ? route.auth : true, handlerPath });
    }
  }
  if (routes.length === 0) {
    for (const entry of entries) {
      const directory = stringValue(entry.directory);
      if (!directory) continue;
      for (const route of entry.routes ?? []) {
        const path = stringValue(route.path);
        const handler = stringValue(route.handler);
        if (!path || !handler) continue;
        const handlerPath = resolve(directory, handler);
        if (within(resolve(directory), handlerPath)) routes.push({ path, auth: true, handlerPath });
      }
    }
  }

  const assets: WebUiExtensionAsset[] = [];
  if (webui?.staticAssets && root) {
    for (const asset of webui.staticAssets) {
      const prefix = stringValue(asset.urlPrefix);
      const assetDirectory = resolveManifestFile(root, asset.directory);
      if (!prefix || !assetDirectory) continue;
      assets.push({ urlPrefix: prefix.replace(/\/+$/, ''), directory: assetDirectory });
    }
  }
  if (assets.length === 0) {
    for (const entry of entries) {
      const directory = stringValue(entry.directory);
      if (!directory || entry.routes?.length) continue;
      assets.push({ urlPrefix: `/${name}/assets`, directory });
    }
  }

  if (routes.length === 0 && assets.length === 0) return null;
  return { extensionName: name, apiRoutes: routes, staticAssets: assets };
}

/**
 * Reads the extensions AionCore says are enabled, then joins its WebUI route
 * directories with each extension's manifest. The manifest is the source of
 * truth for `auth` and `urlPrefix`, which the backend's route list omits.
 */
export async function loadWebUiExtensions(backendPort: number): Promise<WebUiExtensionContribution[]> {
  const [extensions, webui] = await Promise.all([
    fetchData<Array<{ name?: unknown; enabled?: unknown }>>(backendPort, '/api/extensions'),
    fetchData<RawWebUiEntry[]>(backendPort, '/api/extensions/webui'),
  ]);
  if (!extensions || !webui) return [];
  const enabled = new Set(
    extensions
      .filter((extension) => extension.enabled !== false && stringValue(extension.name))
      .map((extension) => String(extension.name))
  );

  const groups = new Map<string, RawWebUiEntry[]>();
  for (const entry of webui) {
    const name = stringValue(entry.extension_name);
    if (!name) continue;
    const list = groups.get(name) ?? [];
    list.push(entry);
    groups.set(name, list);
  }

  const contributions: WebUiExtensionContribution[] = [];
  for (const [name, entries] of groups) {
    const contribution = contributionFor(name, entries, enabled);
    if (contribution) contributions.push(contribution);
  }
  return contributions;
}

export async function loadWebUiExtensionViews(backendPort: number): Promise<WebUiExtensionContributionView[]> {
  const contributions = await loadWebUiExtensions(backendPort);
  return contributions.map((contribution) => ({
    extensionName: contribution.extensionName,
    apiRoutes: contribution.apiRoutes.map((route) => ({ path: route.path, auth: route.auth })),
    staticAssets: contribution.staticAssets.map((asset) => ({
      urlPrefix: asset.urlPrefix,
      directory: asset.directory,
    })),
  }));
}

function loadHandler(path: string): ((req: IncomingMessage, res: ServerResponse) => unknown) | null {
  if (handlers.has(path)) return handlers.get(path) ?? null;
  try {
    const loaded = requireFromHere(path) as
      | ((req: IncomingMessage, res: ServerResponse) => unknown)
      | { default?: (req: IncomingMessage, res: ServerResponse) => unknown };
    const handler = typeof loaded === 'function' ? loaded : loaded.default;
    const result = typeof handler === 'function' ? handler : null;
    handlers.set(path, result);
    return result;
  } catch {
    handlers.set(path, null);
    return null;
  }
}

function jsonResponse(response: ServerResponse): JsonResponse {
  const result = response as JsonResponse;
  result.status = (code) => {
    result.statusCode = code;
    return result;
  };
  result.json = (body) => {
    if (!result.headersSent) result.setHeader('content-type', 'application/json; charset=utf-8');
    result.end(JSON.stringify(body));
  };
  result.send = (body) => {
    if (typeof body === 'string') {
      if (!result.headersSent) result.setHeader('content-type', 'text/plain; charset=utf-8');
      result.end(body);
      return;
    }
    result.json(body);
  };
  return result;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8');
  if (String(request.headers['content-type'] ?? '').includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

function serveAsset(request: IncomingMessage, response: ServerResponse, pathname: string, asset: WebUiExtensionAsset): boolean {
  if (pathname !== asset.urlPrefix && !pathname.startsWith(`${asset.urlPrefix}/`)) return false;
  const encoded = pathname.slice(asset.urlPrefix.length).replace(/^\/+/, '');
  let relativePath: string;
  try {
    relativePath = decodeURIComponent(encoded);
  } catch {
    response.writeHead(400).end();
    return true;
  }
  if (!relativePath || relativePath.includes('\0')) {
    response.writeHead(404).end();
    return true;
  }
  const file = resolve(asset.directory, relativePath);
  if (!within(resolve(asset.directory), file)) {
    response.writeHead(403).end();
    return true;
  }
  let size: number;
  try {
    const stat = statSync(file);
    if (!stat.isFile()) {
      response.writeHead(404).end();
      return true;
    }
    size = stat.size;
  } catch {
    response.writeHead(404).end();
    return true;
  }
  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-cache',
  });
  if (request.method === 'HEAD') {
    response.end();
  } else {
    createReadStream(file).pipe(response);
  }
  return true;
}

/**
 * Handles extension WebUI paths before the app-shell gate. Static assets are
 * public files from the extension; API handlers stay behind the paired-device
 * cookie when the manifest says `auth: true` (webhooks may opt out).
 */
export async function handleWebUiExtensionRequest(
  request: IncomingMessage,
  response: ServerResponse,
  backendPort: number,
  access?: WebUiAccess
): Promise<boolean> {
  const pathname = (request.url ?? '/').split('?')[0];
  if (!/^\/ext-[^/]+/.test(pathname)) return false;

  const contributions = await loadWebUiExtensions(backendPort);
  for (const contribution of contributions) {
    for (const asset of contribution.staticAssets) {
      if (serveAsset(request, response, pathname, asset)) return true;
    }
    const route = contribution.apiRoutes.find((candidate) => candidate.path === pathname);
    if (!route) continue;

    if (route.auth) {
      const device = access?.verify(request.headers.cookie);
      if (!device) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Access denied: this extension route requires a paired device.');
        return true;
      }
      if (device.scope === 'read' && request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'READ_ONLY_DEVICE' }));
        return true;
      }
    }

    const handler = loadHandler(route.handlerPath);
    if (!handler) {
      response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'EXTENSION_HANDLER_FAILED' }));
      return true;
    }
    try {
      (request as JsonRequest).body = await readBody(request);
      await handler(request, jsonResponse(response));
    } catch (error) {
      if (!response.headersSent) {
        response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      response.end(
        JSON.stringify({ error: error instanceof Error ? error.message : 'EXTENSION_HANDLER_FAILED' })
      );
    }
    return true;
  }

  // A known extension namespace with no live route is a 404, not the app shell.
  response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'EXTENSION_ROUTE_NOT_FOUND' }));
  return true;
}
