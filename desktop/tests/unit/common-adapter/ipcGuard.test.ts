import { describe, expect, it } from 'vitest';
import { isAllowedRendererEvent, isTrustedIpcSender, parseBridgeEventPayload } from '@/common/adapter/ipcGuard';

describe('IPC bridge guard', () => {
  it('accepts provider invocations and the one renderer-owned event', () => {
    expect(isAllowedRendererEvent('subscribe-conversation.list')).toBe(true);
    expect(isAllowedRendererEvent('acpConversation.responseStream')).toBe(true);
  });

  it('rejects non-provider event names and oversized names', () => {
    expect(isAllowedRendererEvent('application.restart')).toBe(false);
    expect(isAllowedRendererEvent(`subscribe-${'x'.repeat(300)}`)).toBe(false);
    expect(isAllowedRendererEvent(null)).toBe(false);
  });

  it('only trusts the main frame of an application window', () => {
    const trustedSenderIds = new Set([7]);
    expect(isTrustedIpcSender({ senderId: 7, isMainFrame: true, trustedSenderIds })).toBe(true);
    expect(isTrustedIpcSender({ senderId: 7, isMainFrame: false, trustedSenderIds })).toBe(false);
    expect(isTrustedIpcSender({ senderId: 8, isMainFrame: true, trustedSenderIds })).toBe(false);
  });

  it('rejects malformed, oversized, and unknown bridge payloads', () => {
    expect(parseBridgeEventPayload('{"name":"subscribe-ok","data":1}', 1024)).toEqual({
      name: 'subscribe-ok',
      data: 1,
    });
    expect(parseBridgeEventPayload('not json', 1024)).toBeNull();
    expect(parseBridgeEventPayload(JSON.stringify({ name: 'application.restart' }), 1024)).toBeNull();
    expect(parseBridgeEventPayload('{"name":"subscribe-ok"}', 4)).toBeNull();
    expect(parseBridgeEventPayload({ name: 'subscribe-ok' }, 1024)).toBeNull();
  });
});
