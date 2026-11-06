/**
 * Client for the spec-ai.cn account API.
 *
 * This is the main-process side of the account system: the cloud token never
 * crosses the preload boundary. The wire contract mirrors APP-API v0.5.0.
 */

import { getPlatformServices } from '@/common/platform';

export const SPEC_AI_BASE_URL = 'https://spec-ai.cn';

const ENDPOINTS = {
  sendCode: '/api/auth/send-code',
  register: '/api/auth/register',
  login: '/api/auth/login',
  me: '/api/me',
  resetPassword: '/api/auth/reset-password',
  changePassword: '/api/auth/change-password',
  revokeAll: '/api/auth/revoke-all',
  bind: '/api/auth/bind',
  deactivate: '/api/auth/deactivate',
} as const;

export type SpecAiAuthMethod = 'email' | 'phone';
export type SpecAiSendCodePurpose = 'register' | 'login' | 'reset' | 'bind';

export type SpecAiErrorCode =
  | 'invalid_email'
  | 'invalid_phone'
  | 'invalid_password'
  | 'code_required'
  | 'code_invalid'
  | 'code_used'
  | 'code_expired'
  | 'invalid_target'
  | 'already_registered'
  | 'bad_credentials'
  | 'account_not_registered'
  | 'account_not_found'
  | 'invalid_method'
  | 'unauthorized'
  | 'too_many_attempts'
  | 'too_many_requests'
  | 'account_disabled'
  | 'invalid_plan'
  | 'plan_free'
  | 'order_not_found'
  | 'order_already_paid'
  | 'device_limit'
  | 'invalid_device'
  | 'forbidden'
  | 'payment_not_configured'
  | 'db_unavailable'
  | 'internal'
  | 'not_found'
  | 'unknown';

export type SpecAiUser = {
  id: number;
  email: string | null;
  phone: string | null;
  plan: string;
  planExpiresAt: number | null;
  hasPassword: boolean;
  createdAt: number;
};

export type SpecAiLoginResult = {
  token: string;
  user: SpecAiUser;
};

export type SpecAiLoginParams =
  | { method: 'email'; email: string; password: string }
  | { method: 'phone'; phone: string; code: string };

export type SpecAiRegisterParams =
  | { method: 'email'; email: string; password: string; code: string }
  | { method: 'phone'; phone: string; code: string };

export type SpecAiBindParams =
  | { method: 'email'; email: string; code: string }
  | { method: 'phone'; phone: string; code: string };

export class SpecAiError extends Error {
  readonly status: number;
  readonly code: SpecAiErrorCode;
  readonly detail: unknown;

  constructor(status: number, code: SpecAiErrorCode, detail?: unknown) {
    super(code);
    this.name = 'SpecAiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

type ErrorEnvelope = { ok: false; error: SpecAiErrorCode; detail?: unknown };

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).ok === false &&
    typeof (value as Record<string, unknown>).error === 'string'
  );
}

function baseUrl(): string {
  const override = process.env.SPECJEV_CLOUD_BASE_URL?.trim();
  return (override || SPEC_AI_BASE_URL).replace(/\/+$/, '');
}

async function cloudFetch<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    // Electron's `net.fetch` follows the system proxy, unlike Node's global
    // fetch. The account must work behind the same proxy as the rest of the app.
    response = await getPlatformServices().network.fetch(`${baseUrl()}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new SpecAiError(0, 'unknown', error instanceof Error ? error.message : String(error));
  }

  const contentType = response.headers.get('content-type') ?? '';
  let body: unknown = null;
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok || isErrorEnvelope(body)) {
    const code = isErrorEnvelope(body) ? body.error : 'unknown';
    const detail = isErrorEnvelope(body) ? body.detail : undefined;
    throw new SpecAiError(response.status || 0, code, detail);
  }

  return (body ?? undefined) as T;
}

export async function sendCloudCode(
  target: string,
  purpose: SpecAiSendCodePurpose,
  signal?: AbortSignal
): Promise<{ delivered: boolean }> {
  return cloudFetch<{ delivered: boolean }>(
    ENDPOINTS.sendCode,
    { method: 'POST', body: JSON.stringify({ target, purpose }), signal },
    null
  );
}

export async function loginCloud(params: SpecAiLoginParams, signal?: AbortSignal): Promise<SpecAiLoginResult> {
  return cloudFetch<SpecAiLoginResult>(ENDPOINTS.login, { method: 'POST', body: JSON.stringify(params), signal }, null);
}

export async function registerCloud(params: SpecAiRegisterParams, signal?: AbortSignal): Promise<SpecAiLoginResult> {
  return cloudFetch<SpecAiLoginResult>(
    ENDPOINTS.register,
    { method: 'POST', body: JSON.stringify(params), signal },
    null
  );
}

export async function fetchCloudMe(token: string, signal?: AbortSignal): Promise<SpecAiUser> {
  const body = await cloudFetch<{ user: SpecAiUser }>(ENDPOINTS.me, { method: 'GET', signal }, token);
  return body.user;
}

export async function changeCloudPassword(
  oldPassword: string,
  newPassword: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  await cloudFetch<void>(
    ENDPOINTS.changePassword,
    { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }), signal },
    token
  );
}

export async function resetCloudPassword(
  email: string,
  code: string,
  newPassword: string,
  signal?: AbortSignal
): Promise<void> {
  await cloudFetch<void>(
    ENDPOINTS.resetPassword,
    { method: 'POST', body: JSON.stringify({ email, code, newPassword }), signal },
    null
  );
}

export async function bindCloudIdentity(params: SpecAiBindParams, token: string, signal?: AbortSignal): Promise<void> {
  await cloudFetch<void>(ENDPOINTS.bind, { method: 'POST', body: JSON.stringify(params), signal }, token);
}

export async function revokeCloudSessions(token: string, signal?: AbortSignal): Promise<void> {
  await cloudFetch<void>(ENDPOINTS.revokeAll, { method: 'POST', body: JSON.stringify({}), signal }, token);
}

export async function deactivateCloudAccount(
  params: { password: string } | { code: string },
  token: string,
  signal?: AbortSignal
): Promise<void> {
  await cloudFetch<void>(ENDPOINTS.deactivate, { method: 'POST', body: JSON.stringify(params), signal }, token);
}
