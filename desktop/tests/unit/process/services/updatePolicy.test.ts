import { describe, expect, it } from 'vitest';
import { updateTransportFor } from '@/process/services/update/updatePolicy';

describe('update transport policy', () => {
  it('does not auto-update an unsigned packaged Windows build', () => {
    expect(updateTransportFor({ isPackaged: true, platform: 'win32', signedBuild: false })).toEqual({
      method: 'installer',
      installerReason: 'unsigned',
    });
  });

  it('uses the signed Windows updater only when build provenance says it is signed', () => {
    expect(updateTransportFor({ isPackaged: true, platform: 'win32', signedBuild: true })).toEqual({
      method: 'restart',
    });
  });

  it('keeps development and Linux on the installer path', () => {
    expect(updateTransportFor({ isPackaged: false, platform: 'win32', signedBuild: false })).toEqual({
      method: 'installer',
      installerReason: 'unpackaged',
    });
    expect(updateTransportFor({ isPackaged: true, platform: 'linux', signedBuild: false })).toEqual({
      method: 'installer',
      installerReason: 'linux',
    });
  });
});
