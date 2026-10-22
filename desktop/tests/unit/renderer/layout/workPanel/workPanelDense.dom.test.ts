import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Dense starts the judge rail open only while the window has room for it and a readable
 * transcript. Narrower windows start closed; the person can still open it.
 */
describe('Dense work panel defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem('specjev.ui.v2', '1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.resetModules();
  });

  it('opens on the judge tab at 300px in a wide window', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1400);
    const store = await import('@renderer/components/layout/WorkPanel/workPanelStore');
    expect(store.WORK_PANEL_DEFAULT_WIDTH).toBe(300);
    expect(store.readWorkPanelMemory(null)).toEqual({ open: true, tab: 'judge', width: 300 });
  });

  it('starts closed below 1280px, still on the judge tab', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1100);
    const store = await import('@renderer/components/layout/WorkPanel/workPanelStore');
    expect(store.readWorkPanelMemory(null)).toEqual({ open: false, tab: 'judge', width: 300 });
  });

  it('keeps the Dense choice in its own storage key', async () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1400);
    const store = await import('@renderer/components/layout/WorkPanel/workPanelStore');
    store.rememberWorkPanel('conversation-1', { open: false });
    expect(JSON.parse(localStorage.getItem('mu-work-panel-v2') ?? '{}')).toMatchObject({
      conversations: { 'conversation-1': { open: false, tab: 'judge', width: 300 } },
    });
    expect(localStorage.getItem('mu-work-panel')).toBeNull();
  });
});
