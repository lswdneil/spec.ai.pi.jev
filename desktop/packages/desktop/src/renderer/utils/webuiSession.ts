import { isElectronDesktop } from './platform';

const ROTATION_POLL_MS = 15_000;

/**
 * The desktop can rotate a device token without asking the phone to pair again.
 * The new cookie is delivered by this small same-origin poll: while the WebUI is
 * open it claims a pending rotation and keeps the old cookie until then. A 401
 * means the device was revoked or its grace window closed, so polling stops.
 */
export function installWebUiDeviceRotation(): void {
  if (isElectronDesktop() || typeof window === 'undefined') return;

  let timer = 0;
  let stopped = false;

  const poll = async (): Promise<void> => {
    if (stopped) return;
    try {
      const response = await fetch('/api/pair/rotate', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (response.status === 401) {
        stopped = true;
        return;
      }
    } catch {
      // Offline or the service is restarting; try again on the next tick.
    }
    if (!stopped && document.visibilityState === 'visible') {
      timer = window.setTimeout((): void => {
        void poll();
      }, ROTATION_POLL_MS);
    }
  };

  const onVisibility = (): void => {
    if (document.visibilityState !== 'visible' || stopped) return;
    if (timer) window.clearTimeout(timer);
    timer = 0;
    void poll();
  };

  document.addEventListener('visibilitychange', onVisibility);
  void poll();
}
