export type AccountRole = 'user' | 'admin';

export type AccountPublicUser = {
  id: number;
  email: string | null;
  phone: string | null;
  plan: string;
  planExpiresAt: number | null;
  hasPassword: boolean;
  createdAt: number;
  role: AccountRole;
};

export type AccountStorageSecurity = {
  encryptionAvailable: boolean;
  plaintext: boolean;
};

export type AccountStatus = {
  /** Packaged builds require an account; development builds stay in local mode. */
  required: boolean;
  authenticated: boolean;
  /** Null in local mode, and before the first sign-in. */
  user: AccountPublicUser | null;
  localUserId: string | null;
  localUsername: string | null;
  /** When this local session was first established (epoch ms). */
  lastLoginAt: number | null;
  /** The cloud account was reachable when the session was restored. */
  offline: boolean;
  storage: AccountStorageSecurity;
};

export type AccountFailureCode =
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
  | 'not_authenticated'
  | 'provision_failed'
  | 'local_login_failed'
  | 'network_error'
  | 'unknown';

export type AccountResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; code: AccountFailureCode; status?: number };

export type AccountLoginParams =
  | { method: 'email'; email: string; password: string }
  | { method: 'phone'; phone: string; code: string };

export type AccountRegisterParams =
  | { method: 'email'; email: string; password: string; code: string }
  | { method: 'phone'; phone: string; code: string };

export type AccountBindParams =
  | { method: 'email'; email: string; code: string }
  | { method: 'phone'; phone: string; code: string };

export type AccountSendCodePurpose = 'register' | 'login' | 'reset' | 'bind';

export function isAccountFailure<T>(
  result: AccountResult<T>
): result is { ok: false; code: AccountFailureCode; status?: number } {
  return result.ok === false;
}
