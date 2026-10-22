import { ArrowLeft, Moon, Settings2, Sun } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, cn } from '@/renderer/ui';
import UpdateNotice from '@renderer/components/settings/UpdateNotice';
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

  return (
    <footer className='shrink-0 border-t border-sv-line pt-1.5 pb-1.5'>
      <UpdateNotice collapsed={collapsed} siderTooltipProps={siderTooltipProps} />
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
              <ArrowLeft className='h-3.5 w-3.5 shrink-0' strokeWidth={1.75} />
            ) : (
              <Settings2 className='h-3.5 w-3.5 shrink-0' strokeWidth={1.75} />
            )}
            {iconOnly ? null : <span className='truncate text-[12px]'>{settingsLabel}</span>}
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
              <Sun className='h-3.5 w-3.5' strokeWidth={1.75} />
            ) : (
              <Moon className='h-3.5 w-3.5' strokeWidth={1.75} />
            )}
          </Button>
        </Tooltip>
      </div>
    </footer>
  );
};

export default DenseSiderFooter;
