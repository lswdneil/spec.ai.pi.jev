import { ipcBridge } from '@/common';
import { checkEnvironment } from '@process/startup/environmentCheck';

/**
 * Answers the settings page's component check. It runs on demand, never at startup: the probe
 * starts a Python process, and an installed app should not pay for that before the first window.
 */
export function initEnvironmentBridge(): void {
  ipcBridge.environment.check.provider(() => checkEnvironment());
}
