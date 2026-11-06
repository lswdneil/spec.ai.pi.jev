import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock('@/common/platform', () => ({
  getPlatformServices: () => ({ network: { fetch: fetchMock } }),
}));

import { SpecAiError, fetchCloudMe, loginCloud, sendCloudCode } from '@/process/services/accountCloud';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const user = {
  id: 7,
  email: 'person@example.com',
  phone: null,
  plan: 'free',
  planExpiresAt: null,
  hasPassword: true,
  createdAt: 1,
};

describe('spec-ai cloud account client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    delete process.env.SPECJEV_CLOUD_BASE_URL;
  });

  afterEach(() => {
    delete process.env.SPECJEV_CLOUD_BASE_URL;
  });

  it('posts the password login body without an authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: 'cloud-token', user }));

    await expect(
      loginCloud({ method: 'email', email: 'person@example.com', password: 'correct horse' })
    ).resolves.toEqual({ token: 'cloud-token', user });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://spec-ai.cn/api/auth/login');
    expect(init.method).toBe('POST');
    expect(init.headers).not.toHaveProperty('authorization');
    expect(JSON.parse(init.body as string)).toMatchObject({
      method: 'email',
      email: 'person@example.com',
    });
  });

  it('honours the cloud base URL override and trims trailing slashes', async () => {
    process.env.SPECJEV_CLOUD_BASE_URL = 'https://staging.example.com/';
    fetchMock.mockResolvedValue(jsonResponse({ user }));

    await fetchCloudMe('token');

    expect(fetchMock.mock.calls[0][0]).toBe('https://staging.example.com/api/me');
  });

  it('sends the bearer token for authenticated endpoints', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ user }));

    await expect(fetchCloudMe('secret-token')).resolves.toEqual(user);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ authorization: 'Bearer secret-token' });
  });

  it('turns an error envelope into SpecAiError with the wire code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: false, error: 'bad_credentials', detail: { reason: 'password' } }, 401)
    );

    await expect(loginCloud({ method: 'email', email: 'person@example.com', password: 'wrong' })).rejects.toMatchObject(
      {
        name: 'SpecAiError',
        status: 401,
        code: 'bad_credentials',
        detail: { reason: 'password' },
      }
    );
  });

  it('reports a network failure as status 0 instead of leaking the raw response', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const error = await loginCloud({ method: 'email', email: 'person@example.com', password: 'x' }).catch(
      (value: unknown) => value
    );

    expect(error).toBeInstanceOf(SpecAiError);
    expect(error).toMatchObject({ status: 0, code: 'unknown', detail: 'fetch failed' });
  });

  it('keeps non-JSON failures generic', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway error</html>', { status: 502 }));

    await expect(loginCloud({ method: 'email', email: 'person@example.com', password: 'x' })).rejects.toMatchObject({
      status: 502,
      code: 'unknown',
    });
  });

  it('passes delivered:false through unchanged', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ delivered: false }));

    await expect(sendCloudCode('person@example.com', 'register')).resolves.toEqual({ delivered: false });
  });
});
