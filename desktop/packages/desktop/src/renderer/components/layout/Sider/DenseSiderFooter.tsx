import { ArrowLeft, Settings2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, cn } from '@/renderer/ui';
import UpdateNotice from '@renderer/components/settings/UpdateNotice';
import { ipcBridge } from '@/common';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';

type DenseSiderFooterProps = {
  isMobile: boolean;
  isSettings: boolean;
  collapsed?: boolean;
  siderTooltipProps: SiderTooltipProps;
  onSettingsClick: () => void;
};

/**
 * The Dense footer: the way into the settings (or back out), and light/dark. An update
 * notice still sits above them when one asks for something.
 */
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
  const [userName, setUserName] = useState('');

  useEffect(() => {
    let alive = true;
    void ipcBridge.auth?.currentUser
      ?.invoke?.()
      .then((user: { username: string }): void => {
        if (alive) setUserName(user.username.trim());
      })
      .catch((): void => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <footer className='shrink-0 border-t border-sv-line pt-1.5 pb-1.5'>
      <UpdateNotice collapsed={collapsed} siderTooltipProps={siderTooltipProps} />
      {userName && !iconOnly ? (
        <div data-testid='sider-account' className='mb-1 flex min-w-0 items-center gap-2 px-2 py-1'>
          <span className='flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[4px] bg-sv-raised text-[9px] font-medium text-sv-muted'>
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span className='min-w-0 truncate text-[11.5px] text-sv-text'>{userName}</span>
        </div>
      ) : null}
      <div className={cn('flex gap-0.5', iconOnly ? 'flex-col' : 'items-center')}>
        <Tooltip content={settingsLabel} position='right' disabled={!iconOnly}>
          <Button
            variant='ghost'
            size={iconOnly ? 'icon' : 'sm'}
            onClick={onSettingsClick}
            data-testid='sider-settings'
            aria-label={iconOnly ? settingsLabel : undefined}
            className={cn(
              'text-sv-muted hover:bg-sv-surface hover:text-sv-text',
              iconOnly ? 'mx-auto' : 'min-w-0 flex-1 justify-start gap-2 px-2'
            )}
          >
            {isSettings ? (
              <ArrowLeft className='sv-icon-sider' strokeWidth={1.75} />
            ) : (
              <Settings2 className='sv-icon-sider' strokeWidth={1.75} />
            )}
            {iconOnly ? null : <span className='truncate text-[11.5px]'>{settingsLabel}</span>}
          </Button>
        </Tooltip>
      </div>
    </footer>
  );
};

export default DenseSiderFooter;
