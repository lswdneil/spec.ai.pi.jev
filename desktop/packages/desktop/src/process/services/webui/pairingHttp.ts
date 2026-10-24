import type { IncomingMessage, ServerResponse } from 'node:http';
import { WEBUI_DEVICE_COOKIE, type WebUiAccessManager } from './access';

const MAX_BODY_BYTES = 8 * 1024;
const DEVICE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('PAIRING_BODY_TOO_LARGE'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  if (!host) return false;
  return origin === `http://${host}` || origin === `https://${host}`;
}

function isSecureRequest(request: IncomingMessage): boolean {
  const forwarded = request.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string' && forwarded.split(',')[0]?.trim().toLowerCase() === 'https') return true;
  return Boolean((request.socket as { encrypted?: boolean }).encrypted);
}

function deviceCookie(token: string, request: IncomingMessage): string {
  const secure = isSecureRequest(request) ? '; Secure' : '';
  return `${WEBUI_DEVICE_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DEVICE_COOKIE_MAX_AGE}${secure}`;
}

function remoteAddress(request: IncomingMessage): string {
  // Display/audit only: the proxy may have rewritten the socket to loopback.
  // Never use this value for an authorization decision.
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.socket.remoteAddress ?? '';
}

/**
 * Public pairing endpoints. Everything else in `/api/*` is gated by the device
 * cookie before it reaches AionCore.
 *
 * `POST /api/pair/request` consumes the desktop's one-time code. The request
 * then waits for a human on the desktop to approve it. `GET /api/pair/status`
 * polls that request; only an approved request sets the HttpOnly device cookie.
 */
export async function handlePairingRequest(
  access: WebUiAccessManager,
  request: IncomingMessage,
  response: ServerResponse
): Promise<boolean> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (!url.pathname.startsWith('/api/pair/')) return false;

  if (request.method === 'POST' && url.pathname === '/api/pair/rotate') {
    if (!isSameOrigin(request)) {
      sendJson(response, 403, { error: 'origin_mismatch' });
      return true;
    }
    const result = access.claimRotation(request.headers.cookie);
    if (!result) {
      sendJson(response, 401, { error: 'PAIRING_REQUIRED' });
      return true;
    }
    if (result.rotated) response.setHeader('set-cookie', deviceCookie(result.token, request));
    sendJson(response, 200, { rotated: result.rotated });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/pair/request') {
    if (!isSameOrigin(request)) {
      sendJson(response, 403, { error: 'origin_mismatch' });
      return true;
    }
    let body: { code?: unknown; name?: unknown };
    try {
      body = JSON.parse(await readBody(request)) as { code?: unknown; name?: unknown };
    } catch {
      sendJson(response, 400, { error: 'invalid_body' });
      return true;
    }
    if (typeof body.code !== 'string' || typeof body.name !== 'string') {
      sendJson(response, 400, { error: 'invalid_body' });
      return true;
    }
    const result = access.requestPairing({
      code: body.code,
      name: body.name,
      ip: remoteAddress(request),
      userAgent: request.headers['user-agent'] ?? '',
    });
    if (result.ok === false) {
      const status = result.error === 'inactive' ? 503 : 400;
      sendJson(response, status, result);
      return true;
    }
    sendJson(response, 201, { requestId: result.requestId, expiresAt: result.expiresAt });
    return true;
  }

  if (request.method === 'GET' && url.pathname === '/api/pair/status') {
    const requestId = url.searchParams.get('id');
    if (!requestId) {
      sendJson(response, 200, { paired: access.verifyCookie(request.headers.cookie) !== null });
      return true;
    }
    const result = access.poll(requestId);
    if (result.status === 'approved') {
      response.setHeader('set-cookie', deviceCookie(result.token, request));
    }
    sendJson(response, 200, { status: result.status });
    return true;
  }

  sendJson(response, 404, { error: 'not_found' });
  return true;
}
