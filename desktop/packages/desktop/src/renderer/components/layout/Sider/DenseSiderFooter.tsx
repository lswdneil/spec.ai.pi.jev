import { ArrowLeft, Moon, Settings2, Sun } from 'lucide-react';
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
  theme: string;
  siderTooltipProps: SiderTooltipProps;
  onSettingsClick: () => void;
  onThemeToggle: () => void;
};

/**
 * The Dense footer: the way into the settings (or back out), and light/dark. An update
 * notice still sits above them when one asks for something.
 */
const DenseSiderFooter: React.FC<DenseSiderFooterProps> = ({
  isMobile,
  isSettings,
  collapsed = false,
  theme,
  siderTooltipProps,
  onSettingsClick,
  onThemeToggle,
}) => {
  const { t } = useTranslation();
  const settingsLabel = isSettings ? t('common.back') : t('common.settings');
  const themeLabel = theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode');
  const iconOnly = collapsed && !isMobile;
  const railIconClass = iconOnly ? 'h-5 w-5 shrink-0' : 'h-3.5 w-3.5 shrink-0';
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
              <ArrowLeft className={railIconClass} strokeWidth={1.75} />
            ) : (
              <Settings2 className={railIconClass} strokeWidth={1.75} />
            )}
            {iconOnly ? null : <span className='truncate text-[11.5px]'>{settingsLabel}</span>}
          </Button>
        </Tooltip>
        <Tooltip content={themeLabel} position='right' disabled={!iconOnly}>
          <Button
            variant='ghost'
            size='icon'
            onClick={onThemeToggle}
            data-testid='theme-toggle'
            aria-label={themeLabel}
            className='text-sv-muted hover:bg-sv-surface hover:text-sv-text'
          >
            {theme === 'dark' ? (
              <Sun className={railIconClass} strokeWidth={1.75} />
            ) : (
              <Moon className={railIconClass} strokeWidth={1.75} />
            )}
          </Button>
        </Tooltip>
      </div>
    </footer>
  );
};

export default DenseSiderFooter;
