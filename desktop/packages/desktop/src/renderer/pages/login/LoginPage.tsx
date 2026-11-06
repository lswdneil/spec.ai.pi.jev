import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import MuMark from '@renderer/components/brand/MuMark';
import { useAccount } from '@renderer/hooks/context/AccountContext';
import { changeLanguage } from '@renderer/services/i18n';
import { cn } from '@/renderer/ui';
import type { AccountFailureCode } from '@/common/types/account';
import './login.css';

declare const __APP_VERSION__: string;

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const CODE_RESEND_SECONDS = 60;

type Mode = 'login' | 'register' | 'admin';
type Method = 'email' | 'phone';
type MessageState = { type: 'error' | 'success'; text: string };

const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'en-US', label: 'English' },
] as const;

function errorKey(code: AccountFailureCode): string {
  switch (code) {
    case 'invalid_email':
    case 'invalid_phone':
    case 'invalid_target':
      return 'invalidTarget';
    case 'code_required':
      return 'codeRequired';
    case 'code_invalid':
      return 'codeInvalid';
    case 'code_used':
    case 'code_expired':
      return 'codeExpired';
    case 'invalid_password':
      return 'passwordTooShort';
    case 'too_many_requests':
      return 'tooManyRequests';
    case 'too_many_attempts':
      return 'tooManyAttempts';
    case 'bad_credentials':
      return 'badCredentials';
    case 'already_registered':
      return 'alreadyRegistered';
    case 'account_not_registered':
      return 'accountNotRegistered';
    case 'account_disabled':
      return 'accountDisabled';
    case 'network_error':
      return 'networkError';
    case 'local_login_failed':
    case 'provision_failed':
      return 'localAccountFailed';
    default:
      return 'unknown';
  }
}

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const account = useAccount();

  const [mode, setMode] = useState<Mode>('login');
  const [method, setMethod] = useState<Method>('email');
  const [target, setTarget] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState(0);
  const targetRef = useRef<HTMLInputElement | null>(null);
  const langPickerRef = useRef<HTMLDivElement | null>(null);
  const languageButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const countdownRef = useRef<number | undefined>(undefined);

  const activeLanguageIndex = useMemo(() => {
    const index = LANGUAGES.findIndex((language) => language.code === i18n.language);
    return index >= 0 ? index : 0;
  }, [i18n.language]);

  useEffect(() => {
    document.title = t('login.pageTitle');
    document.documentElement.lang = i18n.language;
  }, [i18n.language, t]);

  useEffect(() => {
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    setActiveLanguage(activeLanguageIndex);
  }, [activeLanguageIndex]);

  useEffect(() => {
    window.setTimeout(() => targetRef.current?.focus(), 0);
  }, [method, mode]);

  useEffect(() => {
    if (!langOpen) return;
    const close = (event: MouseEvent) => {
      if (!langPickerRef.current?.contains(event.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [langOpen]);

  const showError = useCallback(
    (key: string) => setMessage({ type: 'error', text: t(`login.online.errors.${key}`) }),
    [t]
  );

  const startCountdown = useCallback(() => {
    setCountdown(CODE_RESEND_SECONDS);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    countdownRef.current = window.setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          if (countdownRef.current) window.clearInterval(countdownRef.current);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = useCallback(async () => {
    const trimmed = target.trim();
    if (!trimmed) {
      showError('targetRequired');
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const result = await account.sendCode(trimmed, mode === 'register' ? 'register' : 'login');
      if (!result.ok) {
        showError(errorKey(result.code));
        return;
      }
      if (result.data.delivered) {
        setMessage({ type: 'success', text: t('login.online.sending') });
        startCountdown();
      } else {
        // `ok:true` only means the request was accepted; the mail/SMS channel
        // did not deliver. Never claim "sent" or start the countdown then.
        showError('codeNotDelivered');
      }
    } catch {
      showError('networkError');
    } finally {
      setSending(false);
    }
  }, [account, mode, showError, startCountdown, t, target]);

  const persistLanguageAndReload = useCallback(async () => {
    // The login form is the only place that can switch language before the
    // backend knows who the person is. Persist the choice now that the session
    // exists, then reload so every module starts from the account's settings.
    try {
      await changeLanguage(i18n.language);
    } catch {
      // The choice still rides localStorage; the next start keeps it.
    }
    window.setTimeout(() => window.location.reload(), 500);
  }, [i18n.language]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = target.trim();
      if (!trimmed) {
        showError('targetRequired');
        return;
      }
      const register = mode === 'register';
      const needCode = method === 'phone' || register;
      const needPassword = method === 'email';
      if (needPassword && !password) {
        showError('passwordRequired');
        return;
      }
      if (needCode && !code.trim()) {
        showError('codeRequired');
        return;
      }

      setLoading(true);
      setMessage(null);
      try {
        const result = register
          ? await account.register(
              method === 'email'
                ? { method: 'email', email: trimmed, password, code: code.trim() }
                : { method: 'phone', phone: trimmed, code: code.trim() }
            )
          : await account.login(
              method === 'email'
                ? { method: 'email', email: trimmed, password }
                : { method: 'phone', phone: trimmed, code: code.trim() }
            );
        if (!result.ok) {
          showError(errorKey(result.code));
          return;
        }
        setMessage({ type: 'success', text: t('login.online.success') });
        await persistLanguageAndReload();
      } catch {
        showError('networkError');
      } finally {
        setLoading(false);
      }
    },
    [account, code, method, mode, password, persistLanguageAndReload, showError, t, target]
  );

  const chooseLanguage = useCallback((index: number) => {
    const language = LANGUAGES[index];
    if (!language) return;
    setLangOpen(false);
    setActiveLanguage(index);
    void changeLanguage(language.code).catch(() => {
      // Persisting needs a session; switching itself already happened.
    });
    window.setTimeout(() => document.querySelector<HTMLButtonElement>('.sv-login-lang-trigger')?.focus(), 0);
  }, []);

  const handleLanguageKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLangOpen(false);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!langOpen) {
          setLangOpen(true);
          setActiveLanguage(activeLanguageIndex);
          return;
        }
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = (activeLanguage + delta + LANGUAGES.length) % LANGUAGES.length;
        setActiveLanguage(next);
        languageButtonRefs.current[next]?.focus();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && langOpen) {
        event.preventDefault();
        chooseLanguage(activeLanguage);
      }
    },
    [activeLanguage, activeLanguageIndex, chooseLanguage, langOpen]
  );

  const isRegister = mode === 'register';
  const needCode = method === 'phone' || isRegister;
  const needPassword = method === 'email';
  const targetLabel = method === 'email' ? t('login.online.methodEmail') : t('login.online.methodPhone');
  const targetPlaceholder =
    method === 'email' ? t('login.online.emailPlaceholder') : t('login.online.phonePlaceholder');
  const submitLabel = loading
    ? t('login.online.submitting')
    : isRegister
      ? t('login.online.register')
      : t('login.online.login');

  return (
    <div className='sv-login-stage'>
      <section className='sv-login-card' aria-label={t(isRegister ? 'login.online.register' : 'login.submit')}>
        <div className='sv-login-lang' ref={langPickerRef}>
          <button
            type='button'
            className='sv-login-lang-trigger'
            aria-haspopup='listbox'
            aria-expanded={langOpen}
            aria-label={t('login.languageToggle')}
            onClick={() => {
              setLangOpen((open) => !open);
              setActiveLanguage(activeLanguageIndex);
            }}
            onKeyDown={handleLanguageKeyDown}
          >
            <span className='sv-login-lang-label'>{LANGUAGES[activeLanguageIndex]?.label}</span>
            <ChevronDown className='sv-login-lang-chevron' aria-hidden='true' />
          </button>
          {langOpen ? (
            <div className='sv-login-lang-menu' role='listbox' aria-label={t('login.languageToggle')}>
              {LANGUAGES.map((language, index) => (
                <button
                  key={language.code}
                  ref={(node) => {
                    languageButtonRefs.current[index] = node;
                  }}
                  type='button'
                  role='option'
                  aria-selected={language.code === i18n.language}
                  tabIndex={index === activeLanguage ? 0 : -1}
                  className='sv-login-lang-option'
                  onClick={() => chooseLanguage(index)}
                  onKeyDown={handleLanguageKeyDown}
                >
                  <span className='sv-login-lang-option-label'>{language.label}</span>
                  {language.code === i18n.language ? (
                    <Check className='sv-login-lang-check' aria-hidden='true' />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <header className='sv-login-header'>
          <div className='sv-login-logo'>
            <MuMark size={64} title='spec.jev' />
          </div>
          <h1 className='sv-login-title'>spec.jev</h1>
          <p className='sv-login-subtitle'>
            {mode === 'admin'
              ? t('login.online.adminSubtitle')
              : isRegister
                ? t('login.online.registerSubtitle')
                : t('login.subtitle')}
          </p>
        </header>

        <form className='sv-login-form' onSubmit={handleSubmit}>
          <div className='sv-login-method-tabs' role='tablist' aria-label={t('login.online.methodLabel')}>
            {(['email', 'phone'] as const).map((value) => (
              <button
                key={value}
                type='button'
                role='tab'
                aria-selected={method === value}
                tabIndex={method === value ? 0 : -1}
                className={cn('sv-login-method-tab', method === value && 'is-active')}
                onClick={() => setMethod(value)}
              >
                {t(value === 'email' ? 'login.online.methodEmail' : 'login.online.methodPhone')}
              </button>
            ))}
          </div>

          <div className='sv-login-field'>
            <label className='sv-login-label' htmlFor='sv-online-target'>
              {targetLabel}
            </label>
            <input
              ref={targetRef}
              id='sv-online-target'
              name='target'
              className='sv-login-input'
              type={method === 'email' ? 'email' : 'tel'}
              autoComplete={method === 'email' ? 'email' : 'tel'}
              placeholder={targetPlaceholder}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              aria-required='true'
            />
          </div>

          {needPassword ? (
            <div className='sv-login-field'>
              <label className='sv-login-label' htmlFor='sv-online-password'>
                {t('login.online.password')}
              </label>
              <input
                id='sv-online-password'
                name='password'
                className='sv-login-input'
                type='password'
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={t('login.online.passwordPlaceholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-required='true'
              />
            </div>
          ) : null}

          {needCode ? (
            <div className='sv-login-field'>
              <label className='sv-login-label' htmlFor='sv-online-code'>
                {t('login.online.code')}
              </label>
              <div className='sv-login-code-row'>
                <input
                  id='sv-online-code'
                  name='code'
                  className='sv-login-input'
                  type='text'
                  inputMode='numeric'
                  maxLength={6}
                  autoComplete='one-time-code'
                  placeholder={t('login.online.codePlaceholder')}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  aria-required='true'
                />
                <button
                  type='button'
                  className='sv-login-send-code'
                  onClick={() => void handleSendCode()}
                  disabled={countdown > 0 || sending}
                >
                  {sending
                    ? t('login.online.sendingCode')
                    : countdown > 0
                      ? t('login.online.resendIn', { seconds: countdown })
                      : t('login.online.sendCode')}
                </button>
              </div>
            </div>
          ) : null}

          <button className='sv-login-submit' type='submit' disabled={loading}>
            {loading ? <Loader2 className='sv-login-spinner' aria-hidden='true' /> : null}
            <span>{submitLabel}</span>
          </button>

          <div className='sv-login-mode-switch'>
            <button
              type='button'
              className='sv-login-link'
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setMessage(null);
              }}
            >
              {isRegister ? t('login.online.backToLogin') : t('login.online.goRegister')}
            </button>
          </div>
          <div className='sv-login-admin-entry'>
            <button
              type='button'
              className='sv-login-link'
              onClick={() => {
                setMode(mode === 'admin' ? 'login' : 'admin');
                setMessage(null);
              }}
            >
              {mode === 'admin' ? t('login.online.backToLogin') : t('login.online.adminLogin')}
            </button>
          </div>

          {message ? (
            <div className={cn('sv-login-message', message.type)} role={message.type === 'error' ? 'alert' : 'status'}>
              {message.text}
            </div>
          ) : null}
        </form>

        <footer className='sv-login-footer'>
          <p className='sv-login-quote'>{t('login.online.quote')}</p>
          <div className='sv-login-version'>v{APP_VERSION}</div>
        </footer>
      </section>
    </div>
  );
};

export default LoginPage;
