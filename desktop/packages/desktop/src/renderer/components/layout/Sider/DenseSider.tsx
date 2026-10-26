import { Clock, ListChecks, Plus, Search, Sparkles } from 'lucide-react';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Tooltip, cn } from '@/renderer/ui';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import NativeSiderGroup from '@renderer/pages/native/components/NativeSiderGroup';
import { useNativeEnabled } from '@renderer/pages/native/hooks/useNativeConversations';
import { SETTINGS_HOME } from '@renderer/pages/settings/settingsNav';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { rowButtonProps } from '@renderer/utils/ui/rowButton';
import { cleanupSiderTooltips, getSiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import CommandPalette, { toggleCommandPalette } from './CommandPalette';
import DenseSiderFooter from './DenseSiderFooter';

const WorkspaceGroupedHistory = React.lazy(() => import('@renderer/pages/conversation/GroupedHistory'));
const SettingsSider = React.lazy(() => import('@renderer/pages/settings/components/SettingsSider'));

interface DenseSiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

/**
 * The Dense sidebar: three ways in, then the conversations. It keeps the existing history, batch
 * selection, native conversations and command palette; only the chrome is new.
 */
const DenseSider: React.FC<DenseSiderProps> = ({ onSessionClick, collapsed = false }) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const { closePreview } = usePreviewContext();
  const [batchMode, setBatchMode] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettings = pathname.startsWith('/settings');
  const lastNonSettingsPath = useRef('/guid');
  const short = collapsed && !isMobile;
  const tooltipEnabled = short;
  const siderTooltipProps = getSiderTooltipProps(tooltipEnabled);

  useEffect(() => {
    if (!isSettings) lastNonSettingsPath.current = `${pathname}${search}${hash}`;
  }, [hash, isSettings, pathname, search]);

  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    []
  );

  const handleHistoryScroll = () => {
    setScrolling(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setScrolling(false), 650);
  };

  const finishNavigation = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    onSessionClick?.();
  };

  const handleNewChat = () => {
    closePreview();
    setBatchMode(false);
    finishNavigation();
    void navigate('/guid', { state: { resetAssistant: true } });
  };

  const handleScheduled = () => {
    closePreview();
    setBatchMode(false);
    finishNavigation();
    void navigate('/scheduled');
  };

  const handleSkills = () => {
    setBatchMode(false);
    finishNavigation();
    void navigate('/settings/skills');
  };

  const handleSettings = () => {
    setBatchMode(false);
    finishNavigation();
    void navigate(isSettings ? lastNonSettingsPath.current || '/guid' : SETTINGS_HOME);
  };

  const handlePaletteNavigate = () => {
    setBatchMode(false);
    finishNavigation();
  };

  const toggleBatch = () => setBatchMode((value) => !value);

  const nativeOn = useNativeEnabled() === true;
  const historyProps = {
    collapsed,
    tooltipEnabled,
    onSessionClick,
    batchMode,
    onBatchModeChange: setBatchMode,
    afterPinnedContent: <NativeSiderGroup onSessionClick={onSessionClick} />,
    hideEmptyState: nativeOn,
  };

  const navRow = (icon: React.ReactNode, label: string, onClick: () => void, active = false, testId?: string) => (
    <Tooltip content={short ? label : undefined} position='right' disabled={!short}>
      <div
        {...rowButtonProps(onClick)}
        data-testid={testId}
        aria-label={short ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-[27px] shrink-0 items-center gap-2 rounded-[5px] px-2 text-[13px] transition-colors',
          active ? 'bg-sv-selected text-sv-text' : 'text-sv-muted hover:bg-sv-surface hover:text-sv-text',
          short && 'justify-center px-0'
        )}
      >
        <span className='sv-icon-sider flex items-center justify-center shrink-0'>{icon}</span>
        {short ? null : <span className='truncate'>{label}</span>}
      </div>
    </Tooltip>
  );

  return (
    <div className='flex size-full min-h-0 flex-col'>
      <div className='min-h-0 flex-1 overflow-hidden'>
        {isSettings ? (
          <Suspense fallback={<div className='size-full' />}>
            <SettingsSider collapsed={collapsed} tooltipEnabled={tooltipEnabled} />
          </Suspense>
        ) : (
          <div className='flex size-full min-h-0 flex-col gap-2'>
            <Tooltip content={short ? t('conversation.welcome.newConversation') : undefined} position='right'>
              <Button
                variant='secondary'
                size={short ? 'icon' : 'sm'}
                onClick={handleNewChat}
                data-testid='sider-new-chat'
                aria-label={t('conversation.welcome.newConversation')}
                className={cn(
                  'shrink-0 border-sv-line bg-transparent text-sv-text hover:border-sv-line-strong hover:bg-sv-raised',
                  short ? 'mx-auto' : 'w-full justify-start gap-2 px-2'
                )}
              >
                <Plus className='sv-icon-sider' strokeWidth={1.75} />
                {short ? null : <span className='text-[13px]'>{t('conversation.welcome.newConversation')}</span>}
              </Button>
            </Tooltip>

            <nav className='flex flex-col gap-px' aria-label={t('common.sessions')}>
              {navRow(
                <Search className='sv-icon-sider' strokeWidth={1.75} />,
                t('conversation.historySearch.shortTitle'),
                () => {
                  toggleCommandPalette();
                  finishNavigation();
                },
                false,
                'sider-search'
              )}
              {navRow(
                <Clock className='sv-icon-sider' strokeWidth={1.75} />,
                t('cron.scheduledTasks'),
                handleScheduled,
                pathname === '/scheduled',
                'sider-scheduled'
              )}
              {navRow(
                <Sparkles className='sv-icon-sider' strokeWidth={1.75} />,
                t('settings.skills'),
                handleSkills,
                pathname.startsWith('/settings/skills')
              )}
              {navRow(
                <ListChecks className='sv-icon-sider' strokeWidth={1.75} />,
                batchMode ? t('conversation.history.batchModeExit') : t('conversation.history.batchManage'),
                toggleBatch,
                batchMode,
                'sider-batch-mode'
              )}
            </nav>

            {short ? null : (
              <>
                <div className='my-0.5 h-px shrink-0 bg-sv-line' />
                <div
                  className='sv-sider-scroll min-h-0 flex-1 overflow-y-auto'
                  data-scrolling={scrolling ? 'true' : undefined}
                  onScroll={handleHistoryScroll}
                >
                  <Suspense fallback={<div className='min-h-[160px]' />}>
                    <WorkspaceGroupedHistory {...historyProps} />
                  </Suspense>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <CommandPalette onNavigate={handlePaletteNavigate} />
      <DenseSiderFooter
        isMobile={isMobile}
        isSettings={isSettings}
        collapsed={collapsed}
        siderTooltipProps={siderTooltipProps}
        onSettingsClick={handleSettings}
      />
    </div>
  );
};

export default DenseSider;
