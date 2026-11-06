import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, KeyRound, Link2, Loader2, LogOut, RefreshCw, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { Avatar, Button, cn } from '@/renderer/ui';
import { useAccount } from '@renderer/hooks/context/AccountContext';
import type { AccountStatus } from '@/common/types/account';
import './account.css';

type Tab = 'password' | 'bind' | 'security';
type BindMethod = 'phone' | 'email';
type Feedback = { type: 'error' | 'success'; text: string } | null;

const DEVICE_LEVEL_STORAGE = new Set(['i18nextLng', '__mu_theme', '__mu_theme_follows_system']);

export function clearAccountScopedStorage(): void {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && !DEVICE_LEVEL_STORAGE.has(key)) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch {
    // Storage can be unavailable in a locked-down renderer; the reload still clears in-memory state.
  }
}

function initialsFor(status: AccountStatus): string {
  const source = status.user?.email ?? status.user?.phone ?? status.localUsername ?? '';
  const visible = source.split('@')[0] ?? '';
  return (
    visible
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 2)
      .toUpperCase() || 'SJ'
  );
}

function planLabel(plan: string): string {
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Free';
}

export async function logoutAndReload(account: ReturnType<typeof useAccount>): Promise<void> {
  await account.logout();
  clearAccountScopedStorage();
  window.location.reload();
}

type AccountPanelProps = {
  variant?: 'page' | 'modal';
};

const AccountPanel: React.FC<AccountPanelProps> = ({ variant = 'page' }) => {
  const { t } = useTranslation();
  const account = useAccount();
  const status = account.status;
  const user = status?.user ?? null;
  const [tab, setTab] = useState<Tab>('password');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [bindMethod, setBindMethod] = useState<BindMethod>(user?.phone ? 'email' : 'phone');
  const [bindTarget, setBindTarget] = useState('');
  const [bindCode, setBindCode] = useState('');
  const [bindCountdown, setBindCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  const [revokeConfirm, setRevokeConfirm] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateCode, setDeactivateCode] = useState('');
  const [deactivateCountdown, setDeactivateCountdown] = useState(0);
  const [sendingDeactivateCode, setSendingDeactivateCode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (bindCountdown <= 0) return;
    const timer = window.setInterval(() => setBindCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [bindCountdown]);

  useEffect(() => {
    if (deactivateCountdown <= 0) return;
    const timer = window.setInterval(() => setDeactivateCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [deactivateCountdown]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const emailBound = Boolean(user?.email);
  const phoneBound = Boolean(user?.phone);
  const canChangePassword = user?.hasPassword === true;

  useEffect(() => {
    // Phone-only accounts have no password yet; the cloud only accepts a
    // password change for email accounts.
    if (!canChangePassword && tab === 'password') setTab('bind');
  }, [canChangePassword, tab]);

  const copyUserId = useCallback(async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(String(user.id));
      setCopied(true);
    } catch {
      // Clipboard permission is not worth an error banner.
    }
  }, [user]);

  const handleChangePassword = useCallback(async () => {
    if (!oldPassword || newPassword.length < 8) {
      setFeedback({
        type: 'error',
        text: newPassword.length > 0 ? t('login.account.common.passwordLength') : t('login.account.common.required'),
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const result = await account.changePassword(oldPassword, newPassword);
    setBusy(false);
    if (result.ok) {
      setOldPassword('');
      setNewPassword('');
      setFeedback({ type: 'success', text: t('login.account.password.success') });
    } else {
      setFeedback({ type: 'error', text: t('login.account.common.failed') });
    }
  }, [account, newPassword, oldPassword, t]);

  const handleSendBindCode = useCallback(async () => {
    const target = bindTarget.trim();
    if (!target) {
      setFeedback({ type: 'error', text: t('login.account.common.required') });
      return;
    }
    setSendingCode(true);
    setFeedback(null);
    const result = await account.sendCode(target, 'bind');
    setSendingCode(false);
    if (!result.ok) {
      setFeedback({ type: 'error', text: t('login.account.common.failed') });
      return;
    }
    if (!result.data.delivered) {
      setFeedback({ type: 'error', text: t('login.online.errors.codeNotDelivered') });
      return;
    }
    setBindCountdown(60);
    setFeedback({ type: 'success', text: t('login.online.sending') });
  }, [account, bindTarget, t]);

  const handleBind = useCallback(async () => {
    const target = bindTarget.trim();
    if (!target || !bindCode.trim()) {
      setFeedback({ type: 'error', text: t('login.account.common.required') });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const result = await account.bind(
      bindMethod === 'email'
        ? { method: 'email', email: target, code: bindCode.trim() }
        : { method: 'phone', phone: target, code: bindCode.trim() }
    );
    setBusy(false);
    if (result.ok) {
      setBindTarget('');
      setBindCode('');
      setFeedback({ type: 'success', text: t('login.account.bind.success') });
    } else {
      setFeedback({ type: 'error', text: t('login.account.common.failed') });
    }
  }, [account, bindCode, bindMethod, bindTarget, t]);

  const handleSendDeactivateCode = useCallback(async () => {
    if (!user?.phone) {
      setFeedback({ type: 'error', text: t('login.account.security.phoneRequired') });
      return;
    }
    setSendingDeactivateCode(true);
    setFeedback(null);
    const result = await account.sendCode(user.phone, 'login');
    setSendingDeactivateCode(false);
    if (!result.ok) {
      setFeedback({ type: 'error', text: t('login.account.common.failed') });
      return;
    }
    if (!result.data.delivered) {
      setFeedback({ type: 'error', text: t('login.online.errors.codeNotDelivered') });
      return;
    }
    setDeactivateCountdown(60);
    setFeedback({ type: 'success', text: t('login.online.sending') });
  }, [account, t, user?.phone]);

  const handleRevoke = useCallback(async () => {
    if (!revokeConfirm) {
      setRevokeConfirm(true);
      return;
    }
    setBusy(true);
    const result = await account.revokeAll();
    setBusy(false);
    setRevokeConfirm(false);
    if (result.ok) {
      clearAccountScopedStorage();
      window.location.reload();
    } else {
      setFeedback({ type: 'error', text: t('login.account.common.failed') });
    }
  }, [account, revokeConfirm, t]);

  const handleDeactivate = useCallback(async () => {
    if (!deactivateConfirm) {
      setDeactivateConfirm(true);
      return;
    }
    if (user?.hasPassword && !deactivatePassword) {
      setFeedback({ type: 'error', text: t('login.account.common.required') });
      return;
    }
    if (user && !user.hasPassword && !deactivateCode.trim()) {
      setFeedback({ type: 'error', text: t('login.account.common.required') });
      return;
    }
    setBusy(true);
    const result = await account.deactivate(
      user?.hasPassword ? { password: deactivatePassword } : { code: deactivateCode.trim() }
    );
    setBusy(false);
    setDeactivateConfirm(false);
    if (result.ok) {
      clearAccountScopedStorage();
      window.location.reload();
    } else {
      setFeedback({ type: 'error', text: t('login.account.common.failed') });
    }
  }, [account, deactivateCode, deactivateConfirm, deactivatePassword, t, user]);

  const lastLogin = useMemo(() => {
    if (!status?.lastLoginAt) return t('login.account.thisDevice');
    try {
      return new Date(status.lastLoginAt).toLocaleString();
    } catch {
      return t('login.account.thisDevice');
    }
  }, [status?.lastLoginAt, t]);

  if (!status?.required) {
    return (
      <section className='sv-account-local' aria-label={t('login.account.localModeTitle')}>
        <Avatar size={36} shape='square'>
          <UserRound className='sv-account-icon' />
        </Avatar>
        <div>
          <div className='sv-account-local-title'>{t('login.account.localModeTitle')}</div>
          <div className='sv-account-local-hint'>{t('login.account.localModeHint')}</div>
        </div>
      </section>
    );
  }

  if (!user) {
    return <div className='sv-account-empty'>{t('login.account.signedIn')}</div>;
  }

  return (
    <div className={cn('sv-account', variant === 'modal' && 'is-modal')} data-testid='account-panel'>
      <section className='sv-account-card' aria-label={t('login.account.title')}>
        <div className='sv-account-head'>
          <span className='sv-account-avatar'>{initialsFor(status)}</span>
          <div className='sv-account-identity'>
            <div className='sv-account-name'>
              <span className='sv-account-email'>{user.email ?? user.phone}</span>
              <span className='sv-account-badge'>{planLabel(user.plan)}</span>
              {user.role === 'admin' ? (
                <span className='sv-account-badge is-admin'>{t('login.account.admin')}</span>
              ) : null}
            </div>
            <div className='sv-account-sub'>
              <span className='sv-account-dot' aria-hidden='true' />
              {t('login.account.cloudAccount')} · {t('login.account.signedIn')} · {t('login.account.localUser')}{' '}
              {status.localUserId}
            </div>
            {status.offline ? <div className='sv-account-offline'>{t('login.account.offline')}</div> : null}
            {status.storage.plaintext ? <div className='sv-account-offline'>{t('login.account.plaintext')}</div> : null}
          </div>
          <Button
            variant='secondary'
            size='sm'
            className='sv-account-logout'
            onClick={() => void logoutAndReload(account)}
          >
            <LogOut className='sv-account-icon-sm' />
            {t('login.account.logout')}
          </Button>
        </div>

        <dl className='sv-account-kv'>
          <div className='sv-account-kv-row'>
            <dt>{t('login.account.email')}</dt>
            <dd>
              {user.email ? (
                <>
                  {user.email}
                  <span className='sv-account-badge'>{t('login.account.bound')}</span>
                </>
              ) : (
                <span className='sv-account-muted'>{t('login.account.unbound')}</span>
              )}
            </dd>
          </div>
          <div className='sv-account-kv-row'>
            <dt>{t('login.account.phone')}</dt>
            <dd>
              {user.phone ? (
                <>
                  {user.phone}
                  <span className='sv-account-badge'>{t('login.account.bound')}</span>
                </>
              ) : (
                <>
                  <span className='sv-account-muted'>{t('login.account.unbound')}</span>
                  <button type='button' className='sv-account-link' onClick={() => setTab('bind')}>
                    {t('login.account.bindPhone')}
                  </button>
                </>
              )}
            </dd>
          </div>
          <div className='sv-account-kv-row'>
            <dt>{t('login.account.plan')}</dt>
            <dd>
              {planLabel(user.plan)}
              {user.role === 'admin' ? ` · ${t('login.account.fullAccess')}` : ''}
            </dd>
          </div>
          <div className='sv-account-kv-row'>
            <dt>{t('login.account.userId')}</dt>
            <dd>
              <span className='sv-account-mono'>{user.id}</span>
              <button
                type='button'
                className='sv-account-icon-btn'
                onClick={() => void copyUserId()}
                aria-label={t('login.account.copy')}
              >
                <Copy className='sv-account-icon-sm' />
              </button>
              {copied ? <span className='sv-account-copied'>{t('login.account.copied')}</span> : null}
            </dd>
          </div>
          <div className='sv-account-kv-row'>
            <dt>{t('login.account.loginMethod')}</dt>
            <dd>{user.hasPassword ? t('login.account.emailPassword') : t('login.account.phoneCode')}</dd>
          </div>
          <div className='sv-account-kv-row'>
            <dt>{t('login.account.lastLogin')}</dt>
            <dd>
              {lastLogin} · {t('login.account.thisDevice')}
            </dd>
          </div>
        </dl>
      </section>

      <p className='sv-account-note'>
        <ShieldCheck className='sv-account-icon-sm' aria-hidden='true' />
        <span>{t('login.account.isolation')}</span>
      </p>
      {user.role === 'admin' ? (
        <div className='sv-account-admin-note'>
          <ShieldCheck className='sv-account-icon-sm' aria-hidden='true' />
          <span>{t('login.account.adminNote')}</span>
        </div>
      ) : null}

      <div className='sv-account-tabs' role='tablist' aria-label={t('login.account.manageTitle')}>
        {(['password', 'bind', 'security'] as const).map((value) => (
          <button
            key={value}
            type='button'
            role='tab'
            aria-selected={tab === value}
            disabled={value === 'password' && !canChangePassword}
            title={value === 'password' && !canChangePassword ? t('login.account.password.phoneHint') : undefined}
            className={cn('sv-account-tab', tab === value && 'is-active')}
            onClick={() => {
              setTab(value);
              setFeedback(null);
            }}
          >
            {t(`login.account.tabs.${value}`)}
          </button>
        ))}
      </div>

      {feedback ? (
        <div className={cn('sv-account-feedback', feedback.type)} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </div>
      ) : null}

      {tab === 'password' ? (
        <section className='sv-account-tab-card' aria-label={t('login.account.tabs.password')}>
          {canChangePassword ? (
            <>
              <div className='sv-account-field'>
                <label htmlFor='sv-account-old-password'>{t('login.account.password.current')}</label>
                <input
                  id='sv-account-old-password'
                  className='sv-account-input'
                  type='password'
                  autoComplete='current-password'
                  placeholder={t('login.account.password.currentPlaceholder')}
                  value={oldPassword}
                  onChange={(event) => setOldPassword(event.target.value)}
                />
              </div>
              <div className='sv-account-field'>
                <label htmlFor='sv-account-new-password'>{t('login.account.password.new')}</label>
                <input
                  id='sv-account-new-password'
                  className='sv-account-input'
                  type='password'
                  autoComplete='new-password'
                  placeholder={t('login.account.password.newPlaceholder')}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <p className='sv-account-hint'>{t('login.account.password.hint')}</p>
              <div className='sv-account-actions'>
                <Button type='primary' size='sm' onClick={() => void handleChangePassword()} disabled={busy}>
                  {busy ? (
                    <Loader2 className='sv-account-icon-sm sv-account-spin' />
                  ) : (
                    <KeyRound className='sv-account-icon-sm' />
                  )}
                  {t('login.account.password.submit')}
                </Button>
              </div>
            </>
          ) : (
            <div className='sv-account-bind-prompt'>
              <KeyRound className='sv-account-icon' aria-hidden='true' />
              <div>
                <div className='sv-account-bound-title'>{t('login.account.password.phoneTitle')}</div>
                <p className='sv-account-hint'>{t('login.account.password.phoneHint')}</p>
              </div>
              <Button size='sm' onClick={() => setTab('bind')}>
                <Link2 className='sv-account-icon-sm' />
                {t('login.account.password.bindEmail')}
              </Button>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'bind' ? (
        <section className='sv-account-tab-card' aria-label={t('login.account.tabs.bind')}>
          <div className='sv-account-bound-list'>
            <div className='sv-account-bound-row'>
              <div>
                <div className='sv-account-bound-title'>{t('login.account.bind.emailBound')}</div>
                <div className='sv-account-bound-value'>{user.email ?? t('login.account.bind.notBound')}</div>
              </div>
              <span className='sv-account-badge'>
                {emailBound ? t('login.account.bound') : t('login.account.unbound')}
              </span>
            </div>
            <div className='sv-account-bound-row'>
              <div>
                <div className='sv-account-bound-title'>{t('login.account.bind.phoneBound')}</div>
                <div className='sv-account-bound-value'>{user.phone ?? t('login.account.bind.notBound')}</div>
              </div>
              <span className='sv-account-badge'>
                {phoneBound ? t('login.account.bound') : t('login.account.unbound')}
              </span>
            </div>
          </div>

          {emailBound && phoneBound ? (
            <p className='sv-account-hint'>{t('login.account.bind.hint')}</p>
          ) : (
            <>
              <div className='sv-account-field'>
                <label>{t('login.account.bind.method')}</label>
                <div className='sv-account-segmented' role='group'>
                  {(['phone', 'email'] as const).map((value) => (
                    <button
                      key={value}
                      type='button'
                      aria-pressed={bindMethod === value}
                      disabled={value === 'phone' ? phoneBound : emailBound}
                      onClick={() => setBindMethod(value)}
                    >
                      {t(value === 'phone' ? 'login.account.bind.phoneBound' : 'login.account.bind.emailBound')}
                    </button>
                  ))}
                </div>
              </div>
              <div className='sv-account-field'>
                <label htmlFor='sv-account-bind-target'>
                  {t(bindMethod === 'email' ? 'login.account.email' : 'login.account.phone')}
                </label>
                <input
                  id='sv-account-bind-target'
                  className='sv-account-input'
                  type={bindMethod === 'email' ? 'email' : 'tel'}
                  placeholder={t('login.account.bind.targetPlaceholder')}
                  value={bindTarget}
                  onChange={(event) => setBindTarget(event.target.value)}
                />
              </div>
              <div className='sv-account-field'>
                <label htmlFor='sv-account-bind-code'>{t('login.online.code')}</label>
                <div className='sv-account-code-row'>
                  <input
                    id='sv-account-bind-code'
                    className='sv-account-input'
                    inputMode='numeric'
                    maxLength={6}
                    placeholder={t('login.account.bind.codePlaceholder')}
                    value={bindCode}
                    onChange={(event) => setBindCode(event.target.value)}
                  />
                  <Button
                    size='sm'
                    onClick={() => void handleSendBindCode()}
                    disabled={bindCountdown > 0 || sendingCode}
                  >
                    {bindCountdown > 0
                      ? t('login.online.resendIn', { seconds: bindCountdown })
                      : t('login.account.bind.send')}
                  </Button>
                </div>
              </div>
              <p className='sv-account-hint'>{t('login.account.bind.hint')}</p>
              <div className='sv-account-actions'>
                <Button type='primary' size='sm' onClick={() => void handleBind()} disabled={busy}>
                  <Link2 className='sv-account-icon-sm' />
                  {t('login.account.bind.submit')}
                </Button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab === 'security' ? (
        <>
          <section className='sv-account-tab-card' aria-label={t('login.account.tabs.security')}>
            <div className='sv-account-device-row'>
              <div>
                <div className='sv-account-bound-title'>{t('login.account.security.device')}</div>
                <div className='sv-account-bound-value'>
                  {t('login.account.thisDevice')} · {t('login.account.security.currentDevice')} · {lastLogin}
                </div>
              </div>
              <span className='sv-account-badge'>{t('login.account.security.currentDevice')}</span>
            </div>
            <div className='sv-account-device-row'>
              <div>
                <div className='sv-account-bound-title'>{t('login.account.security.revoke')}</div>
                <div className='sv-account-bound-value'>{t('login.account.security.revokeHint')}</div>
              </div>
              <Button size='sm' onClick={() => void handleRevoke()} disabled={busy}>
                <RefreshCw className='sv-account-icon-sm' />
                {revokeConfirm ? t('login.account.security.revokeConfirm') : t('login.account.security.revoke')}
              </Button>
            </div>
          </section>

          <section className='sv-account-tab-card is-danger' aria-label={t('login.account.security.deactivate')}>
            <div className='sv-account-device-row'>
              <div>
                <div className='sv-account-bound-title'>{t('login.account.security.deactivate')}</div>
                <div className='sv-account-bound-value'>{t('login.account.security.deactivateHint')}</div>
              </div>
              <div className='sv-account-danger-actions'>
                {user.hasPassword ? (
                  <input
                    className='sv-account-input is-compact'
                    type='password'
                    autoComplete='current-password'
                    placeholder={t('login.account.security.passwordPlaceholder')}
                    value={deactivatePassword}
                    onChange={(event) => setDeactivatePassword(event.target.value)}
                  />
                ) : (
                  <>
                    <input
                      className='sv-account-input is-compact'
                      inputMode='numeric'
                      maxLength={6}
                      placeholder={t('login.account.security.codePlaceholder')}
                      value={deactivateCode}
                      onChange={(event) => setDeactivateCode(event.target.value)}
                    />
                    <Button
                      size='sm'
                      onClick={() => void handleSendDeactivateCode()}
                      disabled={deactivateCountdown > 0 || sendingDeactivateCode}
                    >
                      {sendingDeactivateCode
                        ? t('login.online.sendingCode')
                        : deactivateCountdown > 0
                          ? t('login.online.resendIn', { seconds: deactivateCountdown })
                          : t('login.account.security.send')}
                    </Button>
                  </>
                )}
                <Button variant='danger' size='sm' onClick={() => void handleDeactivate()} disabled={busy}>
                  <Trash2 className='sv-account-icon-sm' />
                  {deactivateConfirm
                    ? t('login.account.security.deactivateConfirm')
                    : t('login.account.security.deactivate')}
                </Button>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default AccountPanel;
