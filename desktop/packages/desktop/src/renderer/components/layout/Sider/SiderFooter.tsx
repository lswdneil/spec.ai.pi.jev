/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/renderer/ui';
import { ArrowCircleLeft, SettingTwo } from '@icon-park/react';
import classNames from 'classnames';
import UpdateNotice from '@renderer/components/settings/UpdateNotice';
import { rowButtonProps } from '@renderer/utils/ui/rowButton';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';

interface SiderFooterProps {
  isMobile: boolean;
  isSettings: boolean;
  collapsed?: boolean;
  siderTooltipProps: SiderTooltipProps;
  onSettingsClick: () => void;
}

/**
 * One thing and no more: the way into the settings, or back out. Above it, only while an update asks for something,
 * the update notice. The theme switch lives in the titlebar.
 */
const SiderFooter: React.FC<SiderFooterProps> = ({
  isMobile,
  isSettings,
  collapsed = false,
  siderTooltipProps,
  onSettingsClick,
}) => {
  const { t } = useTranslation();

  const settingsIcon = isSettings ? (
    <ArrowCircleLeft
      theme='outline'
      fill='currentColor'
      className='sv-icon-sider block leading-none'
      style={{ lineHeight: 0 }}
    />
  ) : (
    <SettingTwo
      theme='outline'
      fill='currentColor'
      className='sv-icon-sider block leading-none'
      style={{ lineHeight: 0 }}
    />
  );

  return (
    <div className='shrink-0 sider-footer mt-auto pt-8px pb-8px border-t border-solid border-[var(--color-border-2)] border-s-0 border-e-0 border-b-0'>
      <UpdateNotice collapsed={collapsed} siderTooltipProps={siderTooltipProps} />
      <div className={classNames('flex', collapsed ? 'flex-col gap-2px' : 'items-center gap-2px')}>
        <Tooltip
          content={isSettings ? t('common.back') : t('common.settings')}
          position='right'
          disabled={Boolean(siderTooltipProps.disabled)}
        >
          <div
            {...rowButtonProps(onSettingsClick)}
            data-testid='sider-settings'
            aria-label={collapsed ? (isSettings ? t('common.back') : t('common.settings')) : undefined}
            // A plain row in the settings too: a fill there would read as a second selected page next to the rail's.
            className={classNames(
              'group h-32px flex items-center rd-8px cursor-pointer transition-colors hover:bg-fill-2',
              collapsed ? 'w-full justify-center' : 'flex-1 min-w-0 justify-start gap-8px ps-8px pe-8px',
              isMobile && 'sider-footer-btn-mobile'
            )}
          >
            <span className='size-22px flex items-center justify-center shrink-0 text-t-secondary'>{settingsIcon}</span>
            <span className='collapsed-hidden text-t-primary text-13px font-[500] leading-24px truncate'>
              {isSettings ? t('common.back') : t('common.settings')}
            </span>
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

export default SiderFooter;
