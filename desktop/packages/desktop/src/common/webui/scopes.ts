/**
 * What a paired device may do.
 *
 * `read` keeps the WebUI to inspection: GET/HEAD API requests, a small allowlist
 * of read-only POST endpoints, and only KyRN methods that read state.
 * `control` can change settings, conversations, skills, MCP servers, and files.
 *
 * The value is stored with the device and checked on every request, so changing
 * it does not require rotating the device token.
 */
export type WebUiDeviceScope = 'read' | 'control';

export const WEBUI_DEVICE_SCOPES: readonly WebUiDeviceScope[] = ['read', 'control'];

export type WebUiPublicUrlResult = { ok: true; value: string | null } | { ok: false };

/**
 * The public address is an origin, not a full route. Keeping it to an origin
 * prevents a pasted `/chat/123` from silently becoming the pairing landing
 * page, and it is the only shape the reverse proxy setup documents.
 */
export function normalizeWebUiPublicUrl(raw: string): WebUiPublicUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false };
    if (parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) {
      return { ok: false };
    }
    return { ok: true, value: parsed.origin };
  } catch {
    return { ok: false };
  }
}
