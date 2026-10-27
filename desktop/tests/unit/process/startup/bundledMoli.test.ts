import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/unused' },
}));

import { bundledMoliPath, installBundledMoli } from '@process/startup/bundledMoli';

const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'specjev-moli-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('the moli bundled with the app', () => {
  it('finds the packaged binary under resources/bundled-moli', () => {
    const root = temp();
    const binary = join(root, 'bundled-moli', 'win32-x64', 'moli.exe');
    mkdirSync(join(root, 'bundled-moli', 'win32-x64'), { recursive: true });
    writeFileSync(binary, 'moli');

    expect(bundledMoliPath({ packaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toBe(binary);
  });

  it('finds the checkout copy under resources in development', () => {
    const root = temp();
    const binary = join(root, 'resources', 'bundled-moli', 'linux-x64', 'moli');
    mkdirSync(join(root, 'resources', 'bundled-moli', 'linux-x64'), { recursive: true });
    writeFileSync(binary, 'moli');

    expect(bundledMoliPath({ packaged: false, appPath: root, platform: 'linux', arch: 'x64' })).toBe(binary);
  });

  it('leaves a person-set SPECJEV_MOLI alone, and sets it when it is empty', () => {
    const root = temp();
    const binary = join(root, 'bundled-moli', 'win32-x64', 'moli.exe');
    mkdirSync(join(root, 'bundled-moli', 'win32-x64'), { recursive: true });
    writeFileSync(binary, 'moli');

    const chosen = { SPECJEV_MOLI: 'C:\\tools\\moli.exe' };
    expect(installBundledMoli(chosen, { packaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toBe(
      chosen.SPECJEV_MOLI
    );
    expect(chosen.SPECJEV_MOLI).toBe('C:\\tools\\moli.exe');

    const empty: NodeJS.ProcessEnv = {};
    expect(installBundledMoli(empty, { packaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toBe(
      binary
    );
    expect(empty.SPECJEV_MOLI).toBe(binary);
  });
});
