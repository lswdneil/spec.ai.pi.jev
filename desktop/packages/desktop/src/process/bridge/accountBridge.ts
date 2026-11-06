/**
 * The account bridge: the renderer's only door to the cloud account and the
 * local account seat. It answers with envelopes so a failure can never leave
 * an `invoke()` unresolved, and it never includes a token, password or cookie.
 */

import { ipcBridge } from '@/common';
import type { AccountFailureCode, AccountResult, AccountStatus } from '@/common/types/account';
import {
  bindCloudIdentity,
  changeCloudPassword,
  deactivateCloudAccount,
  fetchCloudMe,
  resetCloudPassword,
  revokeCloudSessions,
  sendCloudCode,
  SpecAiError,
} from '../services/accountCloud';
import {
  activeCloudToken,
  ensureAccountReady,
  getAccountStatus,
  loginAccount,
  logoutAccount,
  refreshLocalAccountSession,
  registerAccount,
  updateCloudUser,
} from '../services/accountService';
import { getStorageSecurity } from '../services/accountStore';

function failureCode(error: unknown): { code: AccountFailureCode; status?: number } {
  if (error instanceof SpecAiError) {
    return {
      code: error.code as AccountFailureCode,
      status: error.status || undefined,
    };
  }
  const message = error instanceof Error ? error.message : '';
  if (message.includes('local login failed')) return { code: 'local_login_failed' };
  if (message.includes('provision')) return { code: 'provision_failed' };
  if (message.includes('fetch failed') || message.includes('timed out') || message.includes('timeout')) {
    return { code: 'network_error' };
  }
  return { code: 'unknown' };
}

async function envelope<T>(work: () => Promise<T>): Promise<AccountResult<T>> {
  try {
    const data = await work();
    return { ok: true, data } as AccountResult<T>;
  } catch (error) {
    console.warn('[account] request failed', failureCode(error));
    return { ok: false, ...failureCode(error) };
  }
}

async function plain(work: () => Promise<void>): Promise<AccountResult> {
  try {
    await work();
    return { ok: true };
  } catch (error) {
    console.warn('[account] request failed', failureCode(error));
    return { ok: false, ...failureCode(error) };
  }
}

function fallbackStatus(): AccountStatus {
  return {
    required: true,
    authenticated: false,
    user: null,
    localUserId: null,
    localUsername: null,
    lastLoginAt: null,
    offline: false,
    storage: getStorageSecurity(),
  };
}

function requireToken(): string {
  const token = activeCloudToken();
  if (!token) throw new SpecAiError(401, 'unauthorized');
  return token;
}

export function initAccountBridge(): void {
  ipcBridge.account.status.provider(async () => {
    try {
      await ensureAccountReady();
      return await getAccountStatus();
    } catch (error) {
      console.warn('[account] status unavailable', failureCode(error));
      return fallbackStatus();
    }
  });

  ipcBridge.account.sendCode.provider(({ target, purpose }) => envelope(() => sendCloudCode(target, purpose)));

  ipcBridge.account.login.provider((params) => envelope(() => loginAccount(params)));
  ipcBridge.account.register.provider((params) => envelope(() => registerAccount(params)));

  ipcBridge.account.logout.provider(() => plain(() => logoutAccount()));

  ipcBridge.account.changePassword.provider(({ oldPassword, newPassword }) =>
    plain(async () => {
      await changeCloudPassword(oldPassword, newPassword, requireToken());
    })
  );

  ipcBridge.account.resetPassword.provider(({ email, code, newPassword }) =>
    plain(async () => {
      await resetCloudPassword(email, code, newPassword);
    })
  );

  ipcBridge.account.bind.provider((params) =>
    envelope(async () => {
      const token = requireToken();
      await bindCloudIdentity(params, token);
      const user = await fetchCloudMe(token);
      return updateCloudUser(user);
    })
  );

  ipcBridge.account.revokeAll.provider(() =>
    plain(async () => {
      await revokeCloudSessions(requireToken());
      await logoutAccount();
    })
  );

  ipcBridge.account.deactivate.provider((params) =>
    plain(async () => {
      await deactivateCloudAccount(params, requireToken());
      await logoutAccount();
    })
  );

  ipcBridge.account.refreshLocalSession.provider(() => envelope(() => refreshLocalAccountSession()));
}
