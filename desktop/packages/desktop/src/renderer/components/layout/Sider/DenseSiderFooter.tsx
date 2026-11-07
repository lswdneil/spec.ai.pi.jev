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
  siderWidth: number;
  siderTooltipProps: SiderTooltipProps;
  onSettingsClick: () => void;
};

/**
 * The drawer sits inside the sidebar. The account row is inset from the sidebar's edge, and the drawer is aligned to
 * that row, so its width stops short of the sidebar's right edge. A folded rail keeps a readable menu instead of
 * squeezing it into 48px.
 */
export const accountMenuWidth = (siderWidth: number, iconOnly: boolean): number =>
  iconOnly ? 208 : Math.max(176, siderWidth - 16);

const DenseSiderFooter: React.FC<DenseSiderFooterProps> = ({
  isMobile,
  isSettings,
  collapsed = false,
  siderWidth,
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
  const initial = user
    ? (accountName ?? '')
        .split('@')[0]
        .replace(/[^a-z0-9]/gi, '')
        .slice(0, 2)
        .toUpperCase()
    : '';
  const menuWidth = accountMenuWidth(siderWidth, iconOnly);

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
            align='start'
            style={{ width: menuWidth }}
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
                      <div className='mt-0.5 flex min-w-0 items-baseline gap-1 text-[10px] leading-[1.35] text-sv-faint'>
                        <span className='shrink-0'>{t('login.account.localUser')}</span>
                        <span data-testid='sider-account-local-user-id' className='min-w-0 truncate font-mono'>
                          {account.status.localUserId}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className='flex flex-col gap-0.5 border-t border-sv-line pt-1.5'>
                  <Button
                    variant='ghost'
                    size='md'
                    className='h-8 w-full justify-start gap-2 px-2 text-left text-[12px] font-normal text-sv-text hover:text-sv-text'
                    onClick={() => {
                      setMenuOpen(false);
                      setManagementOpen(true);
                    }}
                  >
                    <UserRound className='sv-icon-sm text-sv-muted' strokeWidth={1.75} />
                    {t('login.account.manage')}
                  </Button>
                  <Button
                    variant='ghost'
                    size='md'
                    className='h-8 w-full justify-start gap-2 px-2 text-left text-[12px] font-normal text-sv-danger hover:text-sv-danger'
                    onClick={() => void handleLogout()}
                  >
                    <LogOut className='sv-icon-sm' strokeWidth={1.75} />
                    {t('login.account.logout')}
                  </Button>
                </div>
              </div>
            }
          >
            <Button
              variant='ghost'
              data-testid='sider-account'
              aria-label={t('common.account')}
              className={cn(
                'h-auto min-w-0 justify-start gap-2 px-2 py-1 text-left hover:bg-sv-surface',
                iconOnly ? 'justify-center px-0' : 'w-full flex-1'
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
            </Button>
          </Popover>
        ) : (
          <Button
            variant='ghost'
            data-testid='sider-account'
            aria-label={t('common.localWorkspace')}
            className={cn(
              'h-auto min-w-0 justify-start gap-2 px-2 py-1 text-left',
              iconOnly ? 'justify-center px-0' : 'w-full flex-1'
            )}
          >
            <Avatar size={22} shape='square' className='text-sv-muted'>
              <UserRound className='sv-icon-sm' strokeWidth={1.75} />
            </Avatar>
            {iconOnly ? null : (
              <span className='min-w-0 flex-1 truncate text-[11.5px] text-sv-text'>{t('common.localWorkspace')}</span>
            )}
          </Button>
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
