import { MessageSquare, Plus, Search, Settings2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/renderer/ui';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { SETTINGS_HOME } from '@renderer/pages/settings/settingsNav';
import { rowButtonProps } from '@renderer/utils/ui/rowButton';
import { toggleCommandPalette } from './Sider/CommandPalette';

/**
 * The phone's four ways in, under the page: the conversations (the sidebar sheet), search, a new
 * conversation, and settings. It is hidden on a desktop, where the sidebar holds all four.
 */
const MobileTabBar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const layout = useLayoutContext();
  const { closePreview } = usePreviewContext();
  const sessionsActive =
    pathname === '/guid' || pathname.startsWith('/conversation/') || pathname.startsWith('/team/');
  const settingsActive = pathname.startsWith('/settings');

  const putSiderAway = () => layout?.setSiderCollapsed?.(true);

  const openSessions = () => {
    // From the settings the sheet would show the settings rail; leave for the last conversation first.
    if (settingsActive) {
      let target = '/guid';
      try {
        const stored = sessionStorage.getItem('mu:last-non-settings-path');
        if (stored && !stored.startsWith('/settings')) target = stored;
      } catch {
        // A browser without session storage still goes home.
      }
      void navigate(target);
    }
    layout?.setSiderCollapsed?.(false);
  };

  const openSearch = () => {
    putSiderAway();
    toggleCommandPalette();
  };

  const startNew = () => {
    closePreview();
    putSiderAway();
    void navigate('/guid', { state: { resetAssistant: true } });
  };

  const openSettings = () => {
    putSiderAway();
    void navigate(SETTINGS_HOME);
  };

  const itemClass = (active: boolean) =>
    cn(
      'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1 text-[10px] transition-colors',
      active ? 'text-sv-text' : 'text-sv-muted'
    );

  return (
    <nav
      className='flex shrink-0 items-stretch border-t border-sv-line bg-sv-chrome pb-[env(safe-area-inset-bottom)]'
      data-testid='mobile-tab-bar'
    >
      <div
        {...rowButtonProps(openSessions)}
        data-testid='tab-sessions'
        className={itemClass(sessionsActive)}
        aria-current={sessionsActive ? 'page' : undefined}
        aria-label={t('common.sessions')}
      >
        <MessageSquare className='h-5 w-5' strokeWidth={1.75} />
        <span className='truncate'>{t('common.sessions')}</span>
      </div>
      <div
        {...rowButtonProps(openSearch)}
        data-testid='tab-search'
        className={itemClass(false)}
        aria-label={t('conversation.historySearch.shortTitle')}
      >
        <Search className='h-5 w-5' strokeWidth={1.75} />
        <span className='truncate'>{t('conversation.historySearch.shortTitle')}</span>
      </div>
      <div
        {...rowButtonProps(startNew)}
        data-testid='tab-new'
        className={cn(itemClass(false), 'gap-0.5')}
        aria-label={t('conversation.welcome.newConversation')}
      >
        <span className='flex h-8 w-8 items-center justify-center rounded-full bg-sv-brand text-sv-on-brand'>
          <Plus className='h-4 w-4' strokeWidth={2} />
        </span>
        <span className='truncate'>{t('conversation.welcome.newConversation')}</span>
      </div>
      <div
        {...rowButtonProps(openSettings)}
        data-testid='tab-settings'
        className={itemClass(settingsActive)}
        aria-current={settingsActive ? 'page' : undefined}
        aria-label={t('common.settings')}
      >
        <Settings2 className='h-5 w-5' strokeWidth={1.75} />
        <span className='truncate'>{t('common.settings')}</span>
      </div>
    </nav>
  );
};

export default MobileTabBar;
