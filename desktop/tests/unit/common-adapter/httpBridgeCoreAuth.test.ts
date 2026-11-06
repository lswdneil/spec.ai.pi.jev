/**
 * The desktop account session lives in the main process. Main-process services
 * reach aioncore through `httpRequest`, so the provider registered by
 * `accountService` must attach the same Cookie/CSRF pair as the page.
 *
 * @vitest-environment node
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRequest, setCoreAuthHeadersProvider } from '@/common/adapter/httpBridge';

function okResponse(body: unknown = { data: { ok: true } }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchSpy(): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue(okResponse());
  vi.stubGlobal('fetch', spy);
  return spy;
}

function sentHeaders(spy: ReturnType<typeof vi.fn>): Record<string, string> {
  return (spy.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>;
}

describe('httpBridge main-process session injection', () => {
  afterEach(() => {
    setCoreAuthHeadersProvider(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('attaches the aioncore Cookie and CSRF token to main-process requests', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    setCoreAuthHeadersProvider(() => ({
      cookie: 'aionui-session=session-value; aionui-csrf-token=csrf-value',
      csrf: 'csrf-value',
    }));
    const spy = fetchSpy();

    await httpRequest('POST', '/api/conversations', { title: 'hello' });

    const headers = sentHeaders(spy);
    expect(headers.Cookie).toBe('aionui-session=session-value; aionui-csrf-token=csrf-value');
    expect(headers['x-csrf-token']).toBe('csrf-value');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('keeps the signed-in session when a caller passes its own Cookie header', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    setCoreAuthHeadersProvider(() => ({ cookie: 'aionui-session=right', csrf: 'right-csrf' }));
    const spy = fetchSpy();

    await httpRequest('GET', '/api/providers', undefined, {
      headers: { Cookie: 'aionui-session=wrong', 'x-csrf-token': 'wrong-csrf' },
    });

    const headers = sentHeaders(spy);
    expect(headers.Cookie).toBe('aionui-session=right');
    expect(headers['x-csrf-token']).toBe('right-csrf');
  });

  it('adds no session headers when nobody is signed in', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    setCoreAuthHeadersProvider(null);
    const spy = fetchSpy();

    await httpRequest('GET', '/api/system/current-user');

    const headers = sentHeaders(spy);
    expect(headers).not.toHaveProperty('Cookie');
    expect(headers).not.toHaveProperty('x-csrf-token');
  });

  it('adds no headers when the provider reports an empty session', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    setCoreAuthHeadersProvider(() => ({}));
    const spy = fetchSpy();

    await httpRequest('GET', '/api/providers');

    expect(sentHeaders(spy)).not.toHaveProperty('Cookie');
  });
});
