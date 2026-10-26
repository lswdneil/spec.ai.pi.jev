import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateDataDirectory, migrateProfileDirectory } from '@process/utils/storageLayoutMigration';

const roots: string[] = [];

const makeRoot = (): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specjev-storage-'));
  roots.push(root);
  return root;
};

const removeAlias = (target: string): void => {
  if (!fs.existsSync(target) || !fs.lstatSync(target).isSymbolicLink()) return;
  try {
    fs.rmdirSync(target);
  } catch {
    fs.unlinkSync(target);
  }
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    for (const name of ['aionui', 'AionUi-Dev']) removeAlias(path.join(root, name));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('storage layout migration', () => {
  it('moves a profile and leaves the old path as an alias', () => {
    const root = makeRoot();
    const oldProfile = path.join(root, 'AionUi-Dev');
    const newProfile = path.join(root, 'spec.jev-Dev');
    fs.mkdirSync(oldProfile);
    fs.writeFileSync(path.join(oldProfile, 'marker'), 'kept');

    expect(migrateProfileDirectory(oldProfile, newProfile)).toBe('moved');
    expect(fs.readFileSync(path.join(newProfile, 'marker'), 'utf8')).toBe('kept');
    expect(fs.lstatSync(oldProfile).isSymbolicLink()).toBe(true);
  });

  it('moves a data folder and leaves the old path as an alias', () => {
    const root = makeRoot();
    const oldData = path.join(root, 'aionui');
    fs.mkdirSync(oldData);
    fs.writeFileSync(path.join(oldData, 'marker'), 'kept');

    expect(migrateDataDirectory(root, 'aionui', 'data')).toBe('moved');
    expect(fs.readFileSync(path.join(root, 'data', 'marker'), 'utf8')).toBe('kept');
    expect(fs.lstatSync(oldData).isSymbolicLink()).toBe(true);
  });

  it('leaves an existing destination alone', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'aionui'));
    fs.mkdirSync(path.join(root, 'data'));

    expect(migrateDataDirectory(root, 'aionui', 'data')).toBe('existing');
  });
});
