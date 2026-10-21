/**
 * Names that earlier versions of the app wrote and that are already on people's machines. The app began as a fork of
 * AionUi and kept its names at first. They are only read here, so that nothing anyone has is lost; nothing new is
 * written under them. Everything else in the app has mu's names.
 */

/** The components' class names before they were mu's. A custom CSS theme written then may still target them. */
export const LEGACY_CLASS_NAMES = /\.aionui-(modal|steps|markdown)\b/g;

/**
 * The image generation server's settings before they were named mu (`IMAGE_GEN_ENV_KEYS`). They are kept in the
 * server's record in AionCore's database, so a server set up earlier still has them until its settings are written.
 */
export const LEGACY_IMAGE_GEN_ENV_KEYS = {
  providerId: 'AIONUI_IMG_PROVIDER_ID',
  platform: 'AIONUI_IMG_PLATFORM',
  baseUrl: 'AIONUI_IMG_BASE_URL',
  apiKey: 'AIONUI_IMG_API_KEY',
  model: 'AIONUI_IMG_MODEL',
  proxy: 'AIONUI_IMG_PROXY',
} as const;

/** The renderer's local storage keys before they were mu's: each old key, and the key it is now. */
export const LEGACY_STORAGE_KEYS: ReadonlyArray<readonly [legacy: string, current: string]> = [
  ['__aionui_theme', '__mu_theme'],
  ['__aionui_theme_follows_system', '__mu_theme_follows_system'],
  ['aionui.emoji.recent', 'mu.emoji.recent'],
  ['aionui.gpuAutoDisableNoticeAckAt', 'mu.gpuAutoDisableNoticeAckAt'],
  ['aionui:recent-workspaces', 'mu:recent-workspaces'],
  ['aionui_workspace_expansion', 'mu_workspace_expansion'],
  ['aionui_workspace_update_time', 'mu_workspace_update_time'],
  ['aionui_agent_browser_first_use_notified', 'mu_agent_browser_first_use_notified'],
  ['aionui_cron_unread', 'mu_cron_unread'],
];

/**
 * Moves what is stored under an old key to its current key, once: a key that already has a value keeps it. Run before
 * anything reads storage (the renderer's runtime patches do).
 */
export function migrateLegacyStorageKeys(storage: Storage): void {
  for (const [legacy, current] of LEGACY_STORAGE_KEYS) {
    try {
      const value = storage.getItem(legacy);
      if (value === null) continue;
      if (storage.getItem(current) === null) storage.setItem(current, value);
      storage.removeItem(legacy);
    } catch {
      // Storage that refuses (full, or blocked) keeps the old key; the setting starts over under the new one.
    }
  }
}
