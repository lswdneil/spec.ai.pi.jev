import { ipcBridge } from '@/common';
import type { WebUiDeviceScope } from '@/common/webui/scopes';
import { Button } from '@/renderer/ui/button';
import { Select } from '@/renderer/ui/select';
import { Message } from '@/renderer/ui/toast';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const formatCode = (code: string | undefined): string => (code ? `${code.slice(0, 3)} ${code.slice(3)}` : '—');

const formatRemaining = (expiresAt: number | undefined, now: number): string => {
  if (!expiresAt) return '—';
  const remaining = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Pairing and device management for the local WebUI. The service binds
 * loopback; this panel is where the desktop hands a phone the one-time code and
 * approves or revokes the resulting device.
 */
const RemoteAccessPanel: React.FC<{ running: boolean }> = ({ running }) => {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [scopeById, setScopeById] = useState<Record<string, WebUiDeviceScope>>({});
  const { data, mutate } = useSWR('webui.access', () => ipcBridge.application.getWebUiAccess.invoke(), {
    refreshInterval: running ? 2_000 : 0,
  });
  const state = data?.data;

  useEffect(() => {
    if (!running) return;
    // The panel mounted before the switch started the service. Refresh once as
    // soon as it is running so the code replaces the placeholder immediately,
    // then keep the countdown and pending list live.
    void mutate();
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [mutate, running]);

  const run = useCallback(
    async (key: string, action: () => Promise<{ success?: boolean }>) => {
      setBusy(key);
      try {
        const result = await action();
        if (!result.success) Message.error(t('settings.remoteAccess.updateFailed'));
        await mutate();
      } catch {
        Message.error(t('settings.remoteAccess.updateFailed'));
      } finally {
        setBusy(null);
      }
    },
    [mutate, t]
  );

  const devices = state?.devices ?? [];
  const pending = state?.pending ?? [];
  const locale = i18n.language;

  return (
    <div className='settings-list' data-testid='remote-access-panel'>
      <div className='flex flex-col gap-16px rounded-[var(--sv-r-chrome)] border border-sv-line bg-sv-surface px-16px py-14px'>
        {running ? (
          <div className='flex items-start justify-between gap-16px'>
            <div className='min-w-0'>
              <div className='text-12px text-t-secondary'>{t('settings.remoteAccess.pairingCode')}</div>
              <div
                className='mt-2px font-mono text-24px leading-32px tracking-[0.18em] text-t-primary'
                data-testid='pairing-code'
              >
                {formatCode(state?.code)}
              </div>
              {state?.code ? (
                <div className='mt-2px text-12px text-t-secondary'>
                  {t('settings.remoteAccess.codeExpires', {
                    time: formatRemaining(state.codeExpiresAt, now),
                  })}
                </div>
              ) : null}
            </div>
            <Button
              size='sm'
              variant='secondary'
              data-testid='pairing-code-refresh'
              disabled={busy !== null}
              onClick={() => void run('rotate', () => ipcBridge.application.rotateWebUiCode.invoke())}
            >
              {t('settings.remoteAccess.newCode')}
            </Button>
          </div>
        ) : (
          <div className='text-12px text-t-secondary'>{t('settings.remoteAccess.stoppedHint')}</div>
        )}

        {running ? (
          <div>
            <div className='text-12px font-500 text-t-primary'>{t('settings.remoteAccess.pendingTitle')}</div>
            <div className='mt-2px text-11px text-t-secondary'>{t('settings.remoteAccess.scopeHint')}</div>
            {pending.length === 0 ? (
              <div className='mt-4px text-12px text-t-secondary'>{t('settings.remoteAccess.pendingEmpty')}</div>
            ) : (
              <ul className='mt-6px flex flex-col gap-6px'>
                {pending.map((item) => (
                  <li
                    key={item.id}
                    className='flex items-center justify-between gap-12px rounded-[var(--sv-r-small)] border border-sv-line px-10px py-8px'
                  >
                    <div className='min-w-0'>
                      <div className='truncate text-13px text-t-primary'>{item.name}</div>
                      <div className='truncate text-11px text-t-secondary'>
                        {item.ip || t('settings.remoteAccess.unknownAddress')}
                      </div>
                    </div>
                    <div className='flex shrink-0 items-center gap-6px'>
                      <Select
                        size='small'
                        className='w-32'
                        data-testid='pending-pairing-scope'
                        value={scopeById[item.id] ?? 'read'}
                        options={[
                          { label: t('settings.remoteAccess.readOnly'), value: 'read' },
                          { label: t('settings.remoteAccess.fullAccess'), value: 'control' },
                        ]}
                        onChange={(value: WebUiDeviceScope) =>
                          setScopeById((current) => ({ ...current, [item.id]: value }))
                        }
                      />
                      <Button
                        size='sm'
                        variant='primary'
                        data-testid='pending-pairing-approve'
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`approve-${item.id}`, () =>
                            ipcBridge.application.approveWebUiPairing.invoke({
                              id: item.id,
                              scope: scopeById[item.id] ?? 'read',
                            })
                          )
                        }
                      >
                        {t('settings.remoteAccess.approve')}
                      </Button>
                      <Button
                        size='sm'
                        variant='secondary'
                        data-testid='pending-pairing-reject'
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`reject-${item.id}`, () =>
                            ipcBridge.application.rejectWebUiPairing.invoke({ id: item.id })
                          )
                        }
                      >
                        {t('settings.remoteAccess.reject')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div>
          <div className='text-12px font-500 text-t-primary'>{t('settings.remoteAccess.devicesTitle')}</div>
          {devices.length === 0 ? (
            <div className='mt-4px text-12px text-t-secondary'>{t('settings.remoteAccess.devicesEmpty')}</div>
          ) : (
            <ul className='mt-6px flex flex-col gap-6px'>
              {devices.map((device) => (
                <li key={device.id} className='flex items-center justify-between gap-12px'>
                  <div className='min-w-0'>
                    <div className='truncate text-13px text-t-primary'>{device.name}</div>
                    <div className='truncate text-11px text-t-secondary'>
                      {t(device.scope === 'read' ? 'settings.remoteAccess.readOnly' : 'settings.remoteAccess.fullAccess')}
                      {' · '}
                      {t('settings.remoteAccess.lastSeen', {
                        time: new Date(device.lastSeenAt).toLocaleString(locale),
                      })}
                    </div>
                  </div>
                  <Button
                    size='sm'
                    variant='text'
                    status='danger'
                    data-testid='device-revoke'
                    disabled={busy !== null}
                    onClick={() =>
                      void run(`revoke-${device.id}`, () =>
                        ipcBridge.application.revokeWebUiDevice.invoke({ id: device.id })
                      )
                    }
                  >
                    {t('settings.remoteAccess.revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {running ? (
          <div className='text-11px text-t-secondary'>{t('settings.remoteAccess.pairHint')}</div>
        ) : null}
      </div>
    </div>
  );
};

export default RemoteAccessPanel;
