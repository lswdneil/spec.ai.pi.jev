const MAX_EVENT_NAME_LENGTH = 256;

const ALLOWED_RENDERER_EVENTS: ReadonlySet<string> = new Set(['acpConversation.responseStream']);

export type BridgeEventPayload = {
  name: string;
  data: unknown;
};

export function isAllowedRendererEvent(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_EVENT_NAME_LENGTH &&
    (name.startsWith('subscribe-') || ALLOWED_RENDERER_EVENTS.has(name))
  );
}

export function isTrustedIpcSender(input: {
  senderId: number;
  isMainFrame: boolean;
  trustedSenderIds: ReadonlySet<number>;
}): boolean {
  return input.isMainFrame && input.trustedSenderIds.has(input.senderId);
}

export function parseBridgeEventPayload(info: unknown, maxBytes: number): BridgeEventPayload | null {
  if (typeof info !== 'string' || info.length > maxBytes) return null;
  try {
    const parsed = JSON.parse(info) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as { name?: unknown; data?: unknown };
    return isAllowedRendererEvent(candidate.name) ? { name: candidate.name, data: candidate.data } : null;
  } catch {
    return null;
  }
}
