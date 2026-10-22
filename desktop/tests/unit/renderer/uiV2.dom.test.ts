import { beforeEach, describe, expect, it } from 'vitest';
import { isUiV2Enabled } from '@/renderer/utils/ui/uiV2';

const KEY = 'specjev.ui.v2';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('the Dense UI flag', () => {
  it('is on when nothing asks for the legacy shell', () => {
    expect(isUiV2Enabled()).toBe(true);
  });

  it('stays off after ?ui=v1, until ?ui=v2 clears that choice', () => {
    window.history.replaceState(null, '', '/?ui=v1');
    expect(isUiV2Enabled()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('0');

    window.history.replaceState(null, '', '/');
    expect(isUiV2Enabled()).toBe(false);

    window.history.replaceState(null, '', '/?ui=v2');
    expect(isUiV2Enabled()).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
