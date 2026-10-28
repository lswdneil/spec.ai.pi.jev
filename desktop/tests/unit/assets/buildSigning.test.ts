import { describe, expect, it } from 'vitest';

const { buildProvenance, resolveBuildSigning } = require('../../../scripts/buildSigning');

describe('desktop build signing policy', () => {
  it('keeps unsigned local builds possible', () => {
    expect(resolveBuildSigning('win32', {})).toEqual({
      required: false,
      signed: false,
      signatureKind: 'none',
    });
  });

  it('rejects a required release build without a Windows certificate', () => {
    expect(() => resolveBuildSigning('win32', { MU_REQUIRE_SIGNED_BUILD: '1' })).toThrow(
      'CSC_LINK and CSC_KEY_PASSWORD'
    );
    expect(() =>
      resolveBuildSigning('win32', { MU_REQUIRE_SIGNED_BUILD: '1', CSC_LINK: 'certificate.pfx' })
    ).toThrow('CSC_LINK and CSC_KEY_PASSWORD');
    expect(() => resolveBuildSigning('linux', { MU_REQUIRE_SIGNED_BUILD: '1' })).toThrow(
      'only Windows Authenticode signing'
    );
  });

  it('records a configured Authenticode signer in build provenance', () => {
    const signing = resolveBuildSigning('win32', {
      MU_REQUIRE_SIGNED_BUILD: '1',
      CSC_LINK: 'certificate.pfx',
      CSC_KEY_PASSWORD: 'secret',
    });
    expect(buildProvenance({ platform: 'win32', arch: 'x64', signing })).toEqual({
      schemaVersion: 1,
      platform: 'win32',
      arch: 'x64',
      signed: true,
      signatureKind: 'authenticode',
    });
  });
});
