import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyBundledResourceIntegrity } from '@/process/startup/bundleIntegrity';

const { digestTree } = require('../../../../packages/shared-scripts/src/bundle-integrity');

function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

describe('verifyBundledResourceIntegrity', () => {
  let resources: string;

  beforeEach(() => {
    resources = mkdtempSync(join(tmpdir(), 'specjev integrity-'));
    writeFile(join(resources, 'harness', 'spec.jev', 'kyrn', 'bin', 'mu.mjs'), 'launcher');
    writeFile(
      join(resources, 'harness', 'bundle.json'),
      JSON.stringify({
        integrity: digestTree(join(resources, 'harness'), { ignore: ['bundle.json'] }),
      })
    );
    writeFile(join(resources, 'bundled-aioncore', 'win32-x64', 'aioncore.exe'), 'backend');
    writeFile(
      join(resources, 'bundled-aioncore', 'win32-x64', 'manifest.json'),
      JSON.stringify({
        integrity: digestTree(join(resources, 'bundled-aioncore', 'win32-x64'), { ignore: ['manifest.json'] }),
      })
    );
  });

  afterEach(() => {
    rmSync(resources, { recursive: true, force: true });
  });

  it('accepts unchanged harness and aioncore trees in an installed resources path with spaces', async () => {
    await expect(
      verifyBundledResourceIntegrity({ resourcesPath: resources, platform: 'win32', arch: 'x64' })
    ).resolves.toEqual([]);
  });

  it('rejects a tampered harness or aioncore file', async () => {
    writeFile(join(resources, 'harness', 'spec.jev', 'kyrn', 'bin', 'mu.mjs'), 'changed');
    await expect(
      verifyBundledResourceIntegrity({ resourcesPath: resources, platform: 'win32', arch: 'x64' })
    ).resolves.toEqual([expect.objectContaining({ component: 'harness', reason: 'digest_mismatch' })]);

    writeFile(join(resources, 'harness', 'spec.jev', 'kyrn', 'bin', 'mu.mjs'), 'launcher');
    writeFile(join(resources, 'bundled-aioncore', 'win32-x64', 'aioncore.exe'), 'changed');
    await expect(
      verifyBundledResourceIntegrity({ resourcesPath: resources, platform: 'win32', arch: 'x64' })
    ).resolves.toEqual([expect.objectContaining({ component: 'aioncore', reason: 'digest_mismatch' })]);
  });

  it('rejects a file added after the digest was recorded', async () => {
    writeFile(join(resources, 'harness', 'spec.jev', 'kyrn', 'bin', 'unexpected.mjs'), 'added');
    await expect(
      verifyBundledResourceIntegrity({ resourcesPath: resources, platform: 'win32', arch: 'x64' })
    ).resolves.toEqual([expect.objectContaining({ component: 'harness', reason: 'digest_mismatch' })]);
  });

  it('fails closed when either integrity record is missing', async () => {
    rmSync(join(resources, 'harness', 'bundle.json'));
    rmSync(join(resources, 'bundled-aioncore', 'win32-x64', 'manifest.json'));
    await expect(
      verifyBundledResourceIntegrity({ resourcesPath: resources, platform: 'win32', arch: 'x64' })
    ).resolves.toEqual([
      expect.objectContaining({ component: 'harness', reason: 'missing_integrity_record' }),
      expect.objectContaining({ component: 'aioncore', reason: 'missing_integrity_record' }),
    ]);
  });
});
