import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const setTheme = vi.fn();
const toggleCommandPalette = vi.fn();
let pathname = '/guid';
let theme = 'light';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ pathname, search: '', hash: '' }),
}));

vi.mock('@renderer/pages/conversation/Preview/context/PreviewContext', () => ({
  usePreviewContext: () => ({ closePreview: () => {} }),
}));
vi.mock('@renderer/utils/ui/siderTooltip', () => ({
  cleanupSiderTooltips: () => {},
  getSiderTooltipProps: () => ({ disabled: true }),
}));
vi.mock('@renderer/utils/ui/focus', () => ({ blurActiveElement: () => {} }));
vi.mock('@renderer/hooks/context/LayoutContext', () => ({ useLayoutContext: () => ({ isMobile: false }) }));
vi.mock('@renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({ theme, setTheme }),
}));
vi.mock('@renderer/pages/conversation/GroupedHistory', () => ({
  default: () => <div data-testid='history' />,
}));
vi.mock('@renderer/pages/native/components/NativeSiderGroup', () => ({ default: () => null }));
vi.mock('@renderer/pages/native/hooks/useNativeConversations', () => ({ useNativeEnabled: () => false }));
vi.mock('@renderer/pages/settings/components/SettingsSider', () => ({
  default: () => <div data-testid='settings-sider' />,
}));
vi.mock('@renderer/components/layout/Sider/CommandPalette', () => ({
  default: () => <div data-testid='command-palette-host' />,
  toggleCommandPalette: () => toggleCommandPalette(),
}));
vi.mock('@renderer/hooks/system/useAccountIdentity', () => ({
  useAccountIdentity: () => ({ identity: { kind: 'local', id: 'system_default_user' } }),
}));

vi.mock('@/renderer/ui', () => ({
  cn: (...values: unknown[]) => values.filter(Boolean).join(' '),
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Avatar: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Popover: ({ children, content }: React.PropsWithChildren<{ content?: React.ReactNode }>) => (
    <>
      {children}
      {content}
    </>
  ),
  Button: ({
    children,
    variant: _variant,
    size: _size,
    ...props
  }: React.PropsWithChildren<{ variant?: string; size?: string }>) => <button {...props}>{children}</button>,
}));

import DenseSider from '@renderer/components/layout/Sider/DenseSider';

describe('Dense sidebar', () => {
  beforeEach(() => {
    navigate.mockClear();
    setTheme.mockClear();
    toggleCommandPalette.mockClear();
    pathname = '/guid';
    theme = 'light';
  });

  afterEach(() => cleanup());

  it('keeps the ways in and the conversation history', async () => {
    render(<DenseSider />);
    expect(screen.getByTestId('sider-new-chat')).toHaveTextContent('conversation.welcome.newConversation');
    expect(screen.getByTestId('sider-search')).toHaveTextContent('conversation.historySearch.shortTitle');
    expect(screen.getByTestId('sider-scheduled')).toHaveTextContent('cron.scheduledTasks');
    expect(screen.getByText('settings.skills')).toBeInTheDocument();
    expect(await screen.findByTestId('history')).toBeInTheDocument();
  });

  it('collapses to a rail of named icons, without the conversations', () => {
    render(<DenseSider collapsed />);
    expect(screen.queryByTestId('history')).not.toBeInTheDocument();
    expect(screen.getByTestId('sider-new-chat')).toHaveAttribute(
      'aria-label',
      'conversation.welcome.newConversation'
    );
    expect(screen.getByTestId('sider-search')).toHaveAttribute('aria-label', 'conversation.historySearch.shortTitle');
    expect(screen.getByTestId('sider-scheduled')).toHaveAttribute('aria-label', 'cron.scheduledTasks');
    expect(screen.getByTestId('sider-batch-mode')).toHaveAttribute(
      'aria-label',
      'conversation.history.batchManage'
    );
  });

  it('starts a conversation, opens the palette and reaches the scheduled tasks', () => {
    render(<DenseSider />);
    fireEvent.click(screen.getByTestId('sider-new-chat'));
    expect(navigate).toHaveBeenCalledWith('/guid', { state: { resetAssistant: true } });

    fireEvent.click(screen.getByTestId('sider-search'));
    expect(toggleCommandPalette).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('sider-scheduled'));
    expect(navigate).toHaveBeenCalledWith('/scheduled');
  });

  it('switches the selection mode from the sidebar', () => {
    render(<DenseSider />);
    const batch = screen.getByTestId('sider-batch-mode');
    expect(batch).toHaveTextContent('conversation.history.batchManage');
    fireEvent.click(batch);
    expect(batch).toHaveTextContent('conversation.history.batchModeExit');
  });

  it('keeps the settings navigation and the palette on a settings route', async () => {
    pathname = '/settings/providers';
    render(<DenseSider />);
    expect(await screen.findByTestId('settings-sider')).toBeInTheDocument();
    expect(screen.queryByTestId('sider-search')).not.toBeInTheDocument();
    expect(screen.getByTestId('command-palette-host')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sider-settings'));
    expect(navigate).toHaveBeenCalledWith('/guid');
  });

  it('shows a local workspace instead of the internal user id', () => {
    render(<DenseSider />);
    expect(screen.getByTestId('sider-account')).toHaveTextContent('common.localWorkspace');
    expect(screen.queryByText('system_default_user')).not.toBeInTheDocument();
    expect(screen.getByTestId('sider-account-menu')).toHaveTextContent('common.localWorkspaceHint');
    expect(screen.getByTestId('sider-account-menu')).toHaveTextContent('common.accountComingSoon');
  });

  it('keeps the settings action and the theme switch in its own place', () => {
    render(<DenseSider />);
    expect(screen.getByTestId('sider-settings')).toHaveAttribute('aria-label', 'common.settings');
    expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument();
  });

  it('presses rows with Enter or Space, as a click would', () => {
    render(<DenseSider />);
    fireEvent.keyDown(screen.getByTestId('sider-scheduled'), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/scheduled');
    fireEvent.keyDown(screen.getByTestId('sider-search'), { key: ' ' });
    expect(toggleCommandPalette).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByTestId('sider-search'), { key: 'a' });
    expect(toggleCommandPalette).toHaveBeenCalledTimes(1);
  });
});
