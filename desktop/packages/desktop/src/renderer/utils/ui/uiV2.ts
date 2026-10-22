/**
 * The Dense UI is the default. Open the app with `?ui=v1` (or store `'0'` under the key)
 * to use the legacy shell; `?ui=v2` clears that choice.
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
      localStorage.removeItem(KEY);
      return true;
    }
    if (mode === 'v1') {
      localStorage.setItem(KEY, '0');
      return false;
    }
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}
