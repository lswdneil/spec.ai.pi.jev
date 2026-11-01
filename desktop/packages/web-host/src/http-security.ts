import type { IncomingMessage } from 'node:http';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutationMethod(method: string | undefined): boolean {
  return MUTATION_METHODS.has((method ?? 'GET').toUpperCase());
}

/**
 * Browsers send Origin on cross-origin writes and on same-origin non-GET/HEAD
 * requests. Requiring it to match Host blocks CSRF against loopback and LAN
 * deployments without relying on the backend's own middleware.
 */
export function isSameOriginRequest(request: IncomingMessage): boolean {
  const host = request.headers.host;
  const origin = request.headers.origin;
  if (host && origin) {
    try {
      const parsed = new URL(origin);
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.origin === origin &&
        parsed.host.toLowerCase() === host.toLowerCase()
      );
    } catch {
      return false;
    }
  }

  // Some browser/form paths omit Origin. Sec-Fetch-Site is browser-controlled
  // and still distinguishes a same-origin request from a cross-site one.
  return request.headers['sec-fetch-site'] === 'same-origin';
}
