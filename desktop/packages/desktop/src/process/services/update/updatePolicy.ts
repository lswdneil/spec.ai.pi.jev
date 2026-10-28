import type { InstallerReason, UpdateMethod } from '@/common/update/updateTypes';

export type UpdateTransport = {
  method: UpdateMethod;
  installerReason?: Exclude<InstallerReason, 'autoUpdateFailed'>;
};

/**
 * Auto-update trusts the Windows Authenticode signature checked by
 * electron-updater. An unsigned packaged Windows build gets the installer
 * path instead, so the feed's self-supplied checksums are never the only
 * integrity check.
 */
export function updateTransportFor({
  isPackaged,
  platform,
  signedBuild,
}: {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  signedBuild: boolean;
}): UpdateTransport {
  if (!isPackaged) return { method: 'installer', installerReason: 'unpackaged' };
  if (platform === 'linux') return { method: 'installer', installerReason: 'linux' };
  if ((platform === 'win32' || platform === 'darwin') && signedBuild) {
    return { method: 'restart' };
  }
  return { method: 'installer', installerReason: 'unsigned' };
}
