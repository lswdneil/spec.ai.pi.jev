import { ArrowLeft, ChevronUp, Settings2, UserRound } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Popover, Tooltip, cn } from '@/renderer/ui';
import UpdateNotice from '@renderer/components/settings/UpdateNotice';
import { useAccountIdentity } from '@renderer/hooks/system/useAccountIdentity';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';

type DenseSiderFooterProps = {
  isMobile: boolean;
  isSettings: boolean;
  collapsed?: boolean;
  siderTooltipProps: SiderTooltipProps;
  onSettingsClick: () => void;
};

/**
 * The Dense footer keeps identity and settings in one quiet row. Local mode has
 * no account yet, so it shows a workspace label rather than the backend's
 * internal user id. The same surface can show a signed-in account later.
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
  const { identity } = useAccountIdentity();
  const local = identity?.kind === 'local';
  const accountName = identity
    ? identity.kind === 'local'
      ? t('common.localWorkspace')
      : identity.displayName
    : '';
  const initial = identity?.kind === 'remote' ? identity.displayName.slice(0, 1).toUpperCase() : '';

  return (
    <footer className='shrink-0 border-t border-sv-line pt-1.5 pb-1.5'>
      <UpdateNotice collapsed={collapsed} siderTooltipProps={siderTooltipProps} />
      <div className={cn('mb-1 flex min-w-0 items-center gap-1 px-1', iconOnly && 'flex-col')}>
        {identity ? (
          <Popover
            position='top'
            className='w-[248px]'
            content={
              <div className='flex flex-col gap-2.5' data-testid='sider-account-menu'>
                <div className='flex items-center gap-2.5'>
                  <Avatar size={32} shape='square'>
                    {initial || <UserRound className='sv-icon-md' strokeWidth={1.75} />}
                  </Avatar>
                  <div className='min-w-0'>
                    <div className='truncate text-[12px] font-medium text-sv-text'>{accountName}</div>
                    {local ? (
                      <div className='mt-0.5 text-[11px] leading-[1.35] text-sv-muted'>
                        {t('common.localWorkspaceHint')}
                      </div>
                    ) : null}
                  </div>
                </div>
                {local ? (
                  <p className='border-t border-sv-line pt-2 text-[11px] leading-[1.45] text-sv-muted'>
                    {t('common.accountComingSoon')}
                  </p>
                ) : null}
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
                  <span className='min-w-0 flex-1 truncate text-[11.5px] text-sv-text'>{accountName}</span>
                  <ChevronUp className='sv-icon-xs shrink-0 text-sv-muted' strokeWidth={1.75} />
                </>
              )}
            </button>
          </Popover>
        ) : null}
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
    </footer>
  );
};

export default DenseSiderFooter;
