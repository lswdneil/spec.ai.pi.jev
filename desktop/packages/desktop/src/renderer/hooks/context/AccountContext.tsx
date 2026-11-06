import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ipcBridge } from '@/common';
import type {
  AccountBindParams,
  AccountLoginParams,
  AccountRegisterParams,
  AccountResult,
  AccountSendCodePurpose,
  AccountStatus,
} from '@/common/types/account';

type AccountContextValue = {
  status: AccountStatus | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<AccountStatus | null>;
  sendCode: (target: string, purpose: AccountSendCodePurpose) => Promise<AccountResult<{ delivered: boolean }>>;
  login: (params: AccountLoginParams) => Promise<AccountResult<AccountStatus>>;
  register: (params: AccountRegisterParams) => Promise<AccountResult<AccountStatus>>;
  logout: () => Promise<AccountResult>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<AccountResult>;
  bind: (params: AccountBindParams) => Promise<AccountResult<AccountStatus>>;
  revokeAll: () => Promise<AccountResult>;
  deactivate: (params: { password: string } | { code: string }) => Promise<AccountResult>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

function fallbackStatus(): AccountStatus {
  const required = typeof window !== 'undefined' && window.__accountRequired === true;
  return {
    required,
    authenticated: !required,
    user: null,
    localUserId: null,
    localUsername: null,
    lastLoginAt: null,
    offline: false,
    storage: { encryptionAvailable: false, plaintext: false },
  };
}

/**
 * The account bridge is an Electron IPC provider. A browser WebUI has neither
 * the preload bridge nor an account provider, so asking for the status there
 * would wait for the IPC timeout instead of starting the app.
 */
function isBrowserWebUi(): boolean {
  if (typeof window === 'undefined') return false;
  const port = (window as Window & { __backendPort?: number }).__backendPort;
  return window.electronAPI == null && port === undefined;
}

async function invokeStatus(): Promise<AccountStatus | null> {
  if (isBrowserWebUi()) return fallbackStatus();
  try {
    let timer: number | undefined;
    const timeout = new Promise<AccountStatus>((resolve) => {
      timer = window.setTimeout(() => resolve(fallbackStatus()), 12_000);
    });
    try {
      return await Promise.race([ipcBridge.account.status.invoke(), timeout]);
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  } catch {
    return fallbackStatus();
  }
}

export const AccountProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await invokeStatus();
    if (next) setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void invokeStatus().then((next) => {
      if (!alive) return;
      setStatus(next ?? fallbackStatus());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const acceptStatus = useCallback((result: AccountResult<AccountStatus>) => {
    if (result.ok) setStatus(result.data);
    return result;
  }, []);

  const sendCode = useCallback(async (target: string, purpose: AccountSendCodePurpose) => {
    return ipcBridge.account.sendCode.invoke({ target, purpose });
  }, []);

  const login = useCallback(
    async (params: AccountLoginParams) => acceptStatus(await ipcBridge.account.login.invoke(params)),
    [acceptStatus]
  );

  const register = useCallback(
    async (params: AccountRegisterParams) => acceptStatus(await ipcBridge.account.register.invoke(params)),
    [acceptStatus]
  );

  const logout = useCallback(async () => {
    const result = await ipcBridge.account.logout.invoke();
    if (result.ok) {
      setStatus((previous) => ({
        ...(previous ?? fallbackStatus()),
        required: true,
        authenticated: false,
        user: null,
        localUserId: null,
        localUsername: null,
        lastLoginAt: null,
        offline: false,
      }));
    }
    return result;
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    return ipcBridge.account.changePassword.invoke({ oldPassword, newPassword });
  }, []);

  const bind = useCallback(
    async (params: AccountBindParams) => acceptStatus(await ipcBridge.account.bind.invoke(params)),
    [acceptStatus]
  );

  const revokeAll = useCallback(async () => {
    const result = await ipcBridge.account.revokeAll.invoke();
    if (result.ok) {
      setStatus((previous) => ({
        ...(previous ?? fallbackStatus()),
        required: true,
        authenticated: false,
        user: null,
        localUserId: null,
        localUsername: null,
        lastLoginAt: null,
      }));
    }
    return result;
  }, []);

  const deactivate = useCallback(async (params: { password: string } | { code: string }) => {
    const result = await ipcBridge.account.deactivate.invoke(params);
    if (result.ok) {
      setStatus((previous) => ({
        ...(previous ?? fallbackStatus()),
        required: true,
        authenticated: false,
        user: null,
        localUserId: null,
        localUsername: null,
        lastLoginAt: null,
      }));
    }
    return result;
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      status,
      loading,
      isAdmin: status?.user?.role === 'admin',
      refresh,
      sendCode,
      login,
      register,
      logout,
      changePassword,
      bind,
      revokeAll,
      deactivate,
    }),
    [bind, changePassword, deactivate, loading, login, logout, refresh, register, revokeAll, sendCode, status]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}
