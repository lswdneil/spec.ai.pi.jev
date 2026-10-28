import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isSignedBuild, readBuildProvenance } from '@/process/startup/buildProvenance';

describe('build provenance', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('treats a missing or explicitly unsigned provenance file as unsigned', () => {
    const root = mkdtempSync(join(tmpdir(), 'specjev-provenance-'));
    roots.push(root);
    expect(readBuildProvenance(root)).toBeNull();
    expect(isSignedBuild({ isPackaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toBe(false);

    writeFileSync(
      join(root, 'build-provenance.json'),
      JSON.stringify({
        schemaVersion: 1,
        platform: 'win32',
        arch: 'x64',
        signed: false,
        signatureKind: 'none',
      })
    );
    expect(isSignedBuild({ isPackaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toBe(false);
  });

  it('accepts Authenticode provenance only for the matching packaged platform and architecture', () => {
    const root = mkdtempSync(join(tmpdir(), 'specjev-provenance-'));
    roots.push(root);
    writeFileSync(
      join(root, 'build-provenance.json'),
      JSON.stringify({
        schemaVersion: 1,
        platform: 'win32',
        arch: 'x64',
        signed: true,
        signatureKind: 'authenticode',
      })
    );
    expect(isSignedBuild({ isPackaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toBe(true);
    expect(isSignedBuild({ isPackaged: true, resourcesPath: root, platform: 'win32', arch: 'arm64' })).toBe(false);
    expect(isSignedBuild({ isPackaged: false, resourcesPath: root, platform: 'win32', arch: 'x64' })).toBe(false);
  });
});
