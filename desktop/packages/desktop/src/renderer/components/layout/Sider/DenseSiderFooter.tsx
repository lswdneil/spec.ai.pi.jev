import { ArrowLeft, ChevronUp, LogOut, Settings2, UserRound } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Popover, Tooltip, cn } from '@/renderer/ui';
import UpdateNotice from '@renderer/components/settings/UpdateNotice';
import AccountManagementModal from '@renderer/components/account/AccountManagementModal';
import { logoutAndReload } from '@renderer/components/account/AccountPanel';
import { useAccount } from '@renderer/hooks/context/AccountContext';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';

type DenseSiderFooterProps = {
  isMobile: boolean;
  isSettings: boolean;
  collapsed?: boolean;
  siderTooltipProps: SiderTooltipProps;
  onSettingsClick: () => void;
};

const DenseSiderFooter: React.FC<DenseSiderFooterProps> = ({
  isMobile,
  isSettings,
  collapsed = false,
  siderTooltipProps,
  onSettingsClick,
}) => {
  const { t } = useTranslation();
  const settingsLabel = isSettings ? t('common.back') : t('common.settings');
  const iconOnly = collapsed && !isMobile;
  const account = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const user = account.status?.user ?? null;
  const authenticated = Boolean(account.status?.authenticated && user);
  const accountName = user?.email ?? user?.phone ?? (authenticated ? account.status?.localUsername : null);
  const plan = user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'Free';
  const subline = user
    ? user.role === 'admin'
      ? t('login.account.admin') + ' · ' + t('login.account.cloudAccount')
      : t('login.account.cloudAccount') + ' · ' + plan
    : t('common.localWorkspaceHint');
  const displayName = accountName || t('common.localWorkspace');
  const initial = user ? (accountName ?? '').split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() : '';

  const handleLogout = async () => {
    setMenuOpen(false);
    await logoutAndReload(account);
  };

  return (
    <footer className='shrink-0 border-t border-sv-line pt-1.5 pb-1.5'>
      <UpdateNotice collapsed={collapsed} siderTooltipProps={siderTooltipProps} />
      <div className={cn('mb-1 flex min-w-0 items-center gap-1 px-1', iconOnly && 'flex-col')}>
        {authenticated ? (
          <Popover
            position='top'
            className='w-[248px]'
            popupVisible={menuOpen}
            onVisibleChange={setMenuOpen}
            content={
              <div className='flex flex-col gap-2.5' data-testid='sider-account-menu'>
                <div className='flex items-center gap-2.5'>
                  <Avatar size={32} shape='square'>
                    {initial || <UserRound className='sv-icon-md' strokeWidth={1.75} />}
                  </Avatar>
                  <div className='min-w-0'>
                    <div className='truncate text-[12px] font-medium text-sv-text'>{displayName}</div>
                    <div className='mt-0.5 truncate text-[11px] leading-[1.35] text-sv-muted'>{subline}</div>
                    {account.status?.localUserId ? (
                      <div className='mt-0.5 truncate font-mono text-[10px] leading-[1.35] text-sv-faint'>
                        {t('login.account.localUser')} {account.status.localUserId}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className='flex flex-col gap-0.5 border-t border-sv-line pt-1.5'>
                  <button
                    type='button'
                    className='flex h-8 items-center gap-2 rounded-[var(--sv-r-control)] px-2 text-left text-[12px] text-sv-text hover:bg-sv-surface'
                    onClick={() => {
                      setMenuOpen(false);
                      setManagementOpen(true);
                    }}
                  >
                    <UserRound className='sv-icon-sm text-sv-muted' strokeWidth={1.75} />
                    {t('login.account.manage')}
                  </button>
                  <button
                    type='button'
                    className='flex h-8 items-center gap-2 rounded-[var(--sv-r-control)] px-2 text-left text-[12px] text-sv-text hover:bg-sv-surface'
                    onClick={() => {
                      setMenuOpen(false);
                      onSettingsClick();
                    }}
                  >
                    <Settings2 className='sv-icon-sm text-sv-muted' strokeWidth={1.75} />
                    {t('login.account.settings')}
                  </button>
                  <button
                    type='button'
                    className='flex h-8 items-center gap-2 rounded-[var(--sv-r-control)] px-2 text-left text-[12px] text-sv-danger hover:bg-sv-surface'
                    onClick={() => void handleLogout()}
                  >
                    <LogOut className='sv-icon-sm' strokeWidth={1.75} />
                    {t('login.account.logout')}
                  </button>
                </div>
              </div>
            }
          >
            <button
              type='button'
              data-testid='sider-account'
              aria-label={t('common.account')}
              className={cn(
                'flex min-w-0 appearance-none items-center gap-2 rounded-[var(--sv-r-control)] border-0 bg-transparent px-2 py-1 text-left transition-colors hover:bg-sv-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sv-focus',
                iconOnly ? 'justify-center px-0' : 'flex-1'
              )}
            >
              <Avatar size={22} shape='square' className='text-sv-muted'>
                {initial || <UserRound className='sv-icon-sm' strokeWidth={1.75} />}
              </Avatar>
              {iconOnly ? null : (
                <>
                  <span className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate text-[11.5px] text-sv-text'>{displayName}</span>
                    <span className='truncate text-[10px] leading-[1.25] text-sv-faint'>{subline}</span>
                  </span>
                  <ChevronUp className='sv-icon-xs shrink-0 text-sv-muted' strokeWidth={1.75} />
                </>
              )}
            </button>
          </Popover>
        ) : (
          <button
            type='button'
            data-testid='sider-account'
            aria-label={t('common.localWorkspace')}
            className={cn(
              'flex min-w-0 appearance-none items-center gap-2 rounded-[var(--sv-r-control)] border-0 bg-transparent px-2 py-1 text-left',
              iconOnly ? 'justify-center px-0' : 'flex-1'
            )}
          >
            <Avatar size={22} shape='square' className='text-sv-muted'>
              <UserRound className='sv-icon-sm' strokeWidth={1.75} />
            </Avatar>
            {iconOnly ? null : (
              <span className='min-w-0 flex-1 truncate text-[11.5px] text-sv-text'>{t('common.localWorkspace')}</span>
            )}
          </button>
        )}
        <Tooltip content={settingsLabel} position='top'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onSettingsClick}
            data-testid='sider-settings'
            aria-label={settingsLabel}
            className={cn('shrink-0 text-sv-muted hover:bg-sv-surface hover:text-sv-text', iconOnly && 'mx-auto')}
          >
            {isSettings ? (
              <ArrowLeft className='sv-icon-sider' strokeWidth={1.75} />
            ) : (
              <Settings2 className='sv-icon-sider' strokeWidth={1.75} />
            )}
          </Button>
        </Tooltip>
      </div>
      <AccountManagementModal open={managementOpen} onClose={() => setManagementOpen(false)} />
    </footer>
  );
};

export default DenseSiderFooter;
