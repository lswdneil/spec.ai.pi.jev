import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { SWRConfig } from 'swr';
import common from '@/renderer/services/i18n/locales/zh-CN/common.json';
import mu from '@/renderer/services/i18n/locales/zh-CN/mu.json';
import JudgePulse from '@/renderer/components/brand/JudgePulse';
import MuMark from '@/renderer/components/brand/MuMark';

import StartupGate from '@/renderer/pages/settings/KyrnSettings/StartupGate';

const { catalog, closeWindow, minimize, maximize, isDesktop, isMac } = vi.hoisted(() => ({
  catalog: vi.fn(),
  closeWindow: vi.fn(),
  minimize: vi.fn(),
  maximize: vi.fn(),
  isDesktop: vi.fn(() => true),
  isMac: vi.fn(() => false),
}));
vi.mock('@/common', () => ({
  ipcBridge: {
    windowControls: {
      close: { invoke: closeWindow },
      minimize: { invoke: minimize },
      maximize: { invoke: maximize },
      unmaximize: { invoke: vi.fn() },
      isMaximized: { invoke: vi.fn().mockResolvedValue(false) },
      maximizedChanged: { on: vi.fn(() => () => {}) },
    },
  },
}));
vi.mock('@renderer/utils/platform', () => ({ isElectronDesktop: isDesktop, isMacOS: isMac }));
vi.mock('@/common/kyrn/bridge', () => ({
  kyrnBridge: { catalog: { invoke: catalog } },
  // As the real one: a failure keeps the code the main process gave it.
  unwrap: (result: { ok: boolean; data?: unknown; error?: string }) => {
    if (!result.ok) throw Object.assign(new Error(result.error), result);
    return result.data;
  },
}));

const copy = common.kyrn;
const i18n = createInstance();
beforeAll(async () => {
  await i18n.init({
    lng: 'zh',
    resources: { zh: { translation: { common, mu } } },
    interpolation: { escapeValue: false },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const view = (node: React.ReactNode) =>
  render(
    <I18nextProvider i18n={i18n}>
      <SWRConfig value={{ provider: () => new Map() }}>{node}</SWRConfig>
    </I18nextProvider>
  );

describe('MuMark', () => {
  it('is decorative unless it is given a name', () => {
    const { container, rerender } = render(<MuMark />);
    expect(container.querySelector('img')).toHaveAttribute('aria-hidden', 'true');
    rerender(<MuMark title='spec.jev' size={20} />);
    expect(screen.getByRole('img', { name: 'spec.jev' })).toHaveAttribute('width', '20');
    expect(container.querySelector('img')).not.toHaveAttribute('aria-hidden');
  });

  it('scales with the size it is given, from the one bundled asset', () => {
    const { container, rerender } = render(<MuMark size={24} />);
    const image = container.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toContain('app.png');
    expect([image.getAttribute('width'), image.getAttribute('height')]).toEqual(['24', '24']);
    rerender(<MuMark size={64} halo />);
    expect(container.querySelector('span')).toHaveStyle({ width: '64px', height: '64px' });
  });
});

describe('JudgePulse', () => {
  it('says exactly the state it is given, idle by default', () => {
    const { rerender } = view(<JudgePulse />);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'idle');
    expect(screen.getByRole('status')).toHaveAccessibleName(copy.brand.judge.idle);
    rerender(
      <I18nextProvider i18n={i18n}>
        <JudgePulse state='judging' />
      </I18nextProvider>
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-state', 'judging');
    expect(screen.getByRole('status')).toHaveAccessibleName(copy.brand.judge.judging);
    rerender(
      <I18nextProvider i18n={i18n}>
        <JudgePulse state='off' />
      </I18nextProvider>
    );
    expect(screen.getByRole('status')).toHaveAccessibleName(copy.brand.judge.off);
  });
});

describe('StartupGate', () => {
  beforeEach(() => {
    catalog.mockReset();
    isDesktop.mockReturnValue(true);
    isMac.mockReturnValue(false);
  });

  // https://github.com/lswdneil/spec.ai.pi.jev/issues/14: the frameless window must remain usable before Layout mounts.
  it.each(['loading', 'error'])('keeps working window controls during %s', async (state) => {
    if (state === 'loading') catalog.mockReturnValue(new Promise(() => {}));
    else catalog.mockResolvedValue({ ok: false, code: 'otherRegistration', error: 'old installation' });
    view(
      <StartupGate>
        <div>app</div>
      </StartupGate>
    );
    if (state === 'error') await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: common.window.minimize }));
    fireEvent.click(screen.getByRole('button', { name: common.window.maximize }));
    fireEvent.click(screen.getByRole('button', { name: common.close }));
    expect(minimize).toHaveBeenCalledTimes(1);
    expect(maximize).toHaveBeenCalledTimes(1);
    expect(closeWindow).toHaveBeenCalledTimes(1);
  });

  it.each(['browser', 'mac'])('does not duplicate window controls in the %s', (runtime) => {
    isDesktop.mockReturnValue(runtime !== 'browser');
    isMac.mockReturnValue(runtime === 'mac');
    catalog.mockReturnValue(new Promise(() => {}));
    view(
      <StartupGate>
        <div>app</div>
      </StartupGate>
    );
    expect(screen.queryByRole('button', { name: common.close })).not.toBeInTheDocument();
  });

  it('shows the mark while spec.jev starts, then the app', async () => {
    const start = Promise.withResolvers<unknown>();
    catalog.mockReturnValue(start.promise);
    view(
      <StartupGate>
        <div>app</div>
      </StartupGate>
    );
    expect(screen.getByTestId('mu-startup')).toHaveTextContent(copy.starting);
    expect(screen.getByTestId('mu-mark')).toBeInTheDocument();
    expect(screen.queryByText('app')).not.toBeInTheDocument();
    start.resolve({ ok: true, data: { assistants: [] } });
    expect(await screen.findByText('app')).toBeInTheDocument();
    expect(screen.queryByTestId('mu-startup')).not.toBeInTheDocument();
  });

  it('reports a failed start with its cause and retries on request', async () => {
    catalog.mockResolvedValueOnce({ ok: false, error: 'adapter missing' });
    view(
      <StartupGate>
        <div>app</div>
      </StartupGate>
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.startupError);
    // A failure without a known code: a sentence in the reader's language, the raw message only as the detail.
    expect(alert).toHaveTextContent(mu.errors.unknown);
    expect(screen.getByTestId('mu-error-detail')).toHaveTextContent('adapter missing');
    expect(alert).not.toHaveTextContent('Error:');
    expect(screen.queryByText('app')).not.toBeInTheDocument();

    catalog.mockResolvedValueOnce({ ok: true, data: { assistants: [] } });
    fireEvent.click(screen.getByRole('button', { name: copy.reload }));
    await waitFor(() => expect(screen.getByText('app')).toBeInTheDocument());
  });

  // https://github.com/lswdneil/spec.ai.pi.jev/issues/14: a retry must show progress and keep the window closable.
  it('shows retry progress, handles another failure and remains retryable', async () => {
    catalog.mockResolvedValueOnce({ ok: false, error: 'first failure' });
    view(
      <StartupGate>
        <div>app</div>
      </StartupGate>
    );
    await screen.findByRole('alert');
    const pending = Promise.withResolvers<unknown>();
    catalog.mockReturnValueOnce(pending.promise);
    const reload = screen.getByRole('button', { name: copy.reload });
    fireEvent.click(reload);
    await waitFor(() => expect(reload).toHaveAttribute('aria-busy', 'true'));
    fireEvent.click(screen.getByRole('button', { name: common.close }));
    expect(closeWindow).toHaveBeenCalledTimes(1);
    pending.resolve({ ok: false, error: 'second failure' });
    await waitFor(() => expect(screen.getByTestId('mu-error-detail')).toHaveTextContent('second failure'));
    expect(reload).not.toHaveAttribute('aria-busy');
    catalog.mockResolvedValueOnce({ ok: true, data: { assistants: [] } });
    fireEvent.click(reload);
    expect(await screen.findByText('app')).toBeInTheDocument();
  });

  it('says why spec.jev did not start in the reader’s language, with no English left in it', async () => {
    catalog.mockResolvedValueOnce({
      ok: false,
      code: 'runtimeOffline',
      error: 'spec.jev runtime is not online. Check the local launcher and login.',
    });
    view(
      <StartupGate>
        <div>app</div>
      </StartupGate>
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(mu.errors.runtimeOffline);
    expect(alert).not.toHaveTextContent('not online');
    expect(screen.queryByTestId('mu-error-detail')).not.toBeInTheDocument();
  });

  // #4: what is left to the person when Windows gives the launcher no spelling without spaces.
  it('says to install spec.jev into a folder whose path has no spaces when it cannot start from where it is', async () => {
    catalog.mockResolvedValueOnce({
      ok: false,
      code: 'installPath',
      error:
        'spec.jev cannot be started from where it is installed: C:\\Program Files\\spec.jev\\resources\\spec.jev\\acp.cmd has spaces',
    });
    view(
      <StartupGate>
        <div>app</div>
      </StartupGate>
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(mu.errors.installPath);
    expect(alert).toHaveTextContent('C:\\spec.jev');
    expect(screen.queryByTestId('mu-error-detail')).not.toBeInTheDocument();
  });
});
