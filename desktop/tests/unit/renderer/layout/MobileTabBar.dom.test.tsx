import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const toggleCommandPalette = vi.fn();
const closePreview = vi.fn();
const setSiderCollapsed = vi.fn();
let pathname = '/conversation/abc';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname }),
}));

vi.mock('@renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: true, setSiderCollapsed }),
}));
vi.mock('@renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  usePreviewContext: () => ({ closePreview }),
}));
vi.mock('@renderer/components/layout/Sider/CommandPalette', () => ({
  toggleCommandPalette: () => toggleCommandPalette(),
}));

import MobileTabBar from '@renderer/components/layout/MobileTabBar';

describe('mobile tab bar', () => {
  beforeEach(() => {
    navigate.mockClear();
    toggleCommandPalette.mockClear();
    closePreview.mockClear();
    setSiderCollapsed.mockClear();
    sessionStorage.clear();
    pathname = '/conversation/abc';
  });

  afterEach(() => cleanup());

  it('shows the four ways in', () => {
    render(<MobileTabBar />);
    expect(screen.getByTestId('tab-sessions')).toHaveTextContent('common.sessions');
    expect(screen.getByTestId('tab-search')).toHaveTextContent('conversation.historySearch.shortTitle');
    expect(screen.getByTestId('tab-new')).toHaveTextContent('conversation.welcome.newConversation');
    expect(screen.getByTestId('tab-settings')).toHaveTextContent('common.settings');
  });

  it('marks the section that is open', () => {
    render(<MobileTabBar />);
    expect(screen.getByTestId('tab-sessions')).toHaveAttribute('aria-current', 'page');
    cleanup();

    pathname = '/settings/providers';
    render(<MobileTabBar />);
    expect(screen.getByTestId('tab-settings')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-sessions')).not.toHaveAttribute('aria-current');
  });

  it('opens the conversation sheet', () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByTestId('tab-sessions'));
    expect(setSiderCollapsed).toHaveBeenCalledWith(false);
  });

  it('leaves the settings before opening the conversation sheet', () => {
    pathname = '/settings/providers';
    sessionStorage.setItem('mu:last-non-settings-path', '/conversation/abc');
    render(<MobileTabBar />);
    fireEvent.click(screen.getByTestId('tab-sessions'));
    expect(navigate).toHaveBeenCalledWith('/conversation/abc');
    expect(setSiderCollapsed).toHaveBeenCalledWith(false);
  });

  it('puts the sheet away and opens search', () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByTestId('tab-search'));
    expect(setSiderCollapsed).toHaveBeenCalledWith(true);
    expect(toggleCommandPalette).toHaveBeenCalledTimes(1);
  });

  it('starts a new conversation', () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByTestId('tab-new'));
    expect(closePreview).toHaveBeenCalledTimes(1);
    expect(setSiderCollapsed).toHaveBeenCalledWith(true);
    expect(navigate).toHaveBeenCalledWith('/guid', { state: { resetAssistant: true } });
  });

  it('opens the settings home', () => {
    render(<MobileTabBar />);
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(setSiderCollapsed).toHaveBeenCalledWith(true);
    expect(navigate).toHaveBeenCalledWith('/settings/providers');
  });
});
