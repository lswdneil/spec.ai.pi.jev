import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const {
  digestTree,
  refreshIntegrityRecord,
  verifyTreeDigest,
  writeIntegrityRecord,
} = require('../../../packages/shared-scripts/src/bundle-integrity');

function writeFile(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

describe('bundle integrity records', () => {
  let root: string;

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('hashes the files, not empty directories that packaging may drop', () => {
    root = mkdtempSync(join(tmpdir(), 'specjev bundle integrity-'));
    writeFile(join(root, 'managed resources', 'node.exe'), 'node');
    const before = digestTree(root);

    mkdirSync(join(root, 'managed resources', 'empty directory'), { recursive: true });
    expect(digestTree(root)).toEqual(before);
  });

  it('writes and refreshes a self-excluding record for a path with spaces', () => {
    root = mkdtempSync(join(tmpdir(), 'specjev bundle integrity-'));
    const manifest = join(root, 'manifest.json');
    writeFile(join(root, 'managed resources', 'node.exe'), 'node');

    writeIntegrityRecord(manifest, { platform: 'win32', arch: 'x64' });
    const initial = JSON.parse(readFileSync(manifest, 'utf8'));
    expect(initial.integrity.files).toBe(1);
    expect(verifyTreeDigest(root, initial.integrity, { ignore: ['manifest.json'] })).toMatchObject({ ok: true });

    writeFile(manifest, JSON.stringify({ ...initial, generatedAt: 'later' }));
    const refreshed = refreshIntegrityRecord(manifest);
    expect(refreshed.integrity).toEqual(initial.integrity);
  });

  it('stamps a copied tree without stale directory entries from the source', () => {
    root = mkdtempSync(join(tmpdir(), 'specjev bundle integrity-'));
    const source = join(root, 'prepared');
    const packaged = join(root, 'resources', 'bundled-aioncore', 'win32-x64');
    writeFile(join(source, 'aioncore.exe'), 'backend');
    writeFile(join(source, 'managed-resources', 'manifest.json'), '{}');
    mkdirSync(join(source, 'managed-resources', 'empty'), { recursive: true });
    writeIntegrityRecord(join(source, 'manifest.json'), { platform: 'win32', arch: 'x64' });

    writeFile(join(packaged, 'aioncore.exe'), 'backend');
    writeFile(join(packaged, 'managed-resources', 'manifest.json'), '{}');
    writeFile(join(packaged, 'manifest.json'), readFileSync(join(source, 'manifest.json')));
    const refreshed = refreshIntegrityRecord(join(packaged, 'manifest.json'));

    expect(refreshed.integrity.files).toBe(2);
    expect(verifyTreeDigest(packaged, refreshed.integrity, { ignore: ['manifest.json'] })).toMatchObject({ ok: true });
  });
});
