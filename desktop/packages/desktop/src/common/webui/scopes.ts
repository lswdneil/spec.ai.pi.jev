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
