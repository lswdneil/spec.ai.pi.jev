import { app } from 'electron';

export type BackendIdentityMode = 'local' | 'webui';

/**
 * Packaged builds require a cloud account and run aioncore in webui mode. A
 * development build keeps the old local mode unless explicitly asked, so the
 * existing test and development flows do not need an account before the login
 * screen exists.
 */
export function resolveIdentityMode(): BackendIdentityMode {
  const override = process.env.SPECJEV_IDENTITY_MODE;
  if (override === 'local' || override === 'webui') return override;
  return app.isPackaged ? 'webui' : 'local';
}
