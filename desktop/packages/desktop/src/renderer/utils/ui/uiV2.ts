/**
 * Phase 1 feature flag for the Dense shell work.
 *
 * Enable: open the app with `?ui=v2`, or run
 * `localStorage.setItem('specjev.ui.v2', '1')` in DevTools and reload.
 * Disable: `?ui=v1` or remove the key.
 */
const KEY = 'specjev.ui.v2';

export function isUiV2Enabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const query = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const hashQuery = hash.includes('?') ? new URLSearchParams(hash.slice(hash.indexOf('?') + 1)) : null;
    const mode = query.get('ui') ?? hashQuery?.get('ui');
    if (mode === 'v2') {
      localStorage.setItem(KEY, '1');
      return true;
    }
    if (mode === 'v1') {
      localStorage.removeItem(KEY);
      return false;
    }
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
