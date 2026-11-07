import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/unused' },
}));

import { bundledPython, installBundledPython } from '@process/startup/bundledPython';

const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'specjev-python-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('the Python bundled with the app', () => {
  it('finds the packaged interpreter under resources/bundled-python', () => {
    const root = temp();
    const executable = join(root, 'bundled-python', 'win32-x64', 'python.exe');
    mkdirSync(join(root, 'bundled-python', 'win32-x64'), { recursive: true });
    writeFileSync(executable, 'python');

    expect(bundledPython({ packaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toEqual({
      dir: join(root, 'bundled-python', 'win32-x64'),
      executable,
      pathDir: join(root, 'bundled-python', 'win32-x64'),
    });
  });

  it('finds the checkout copy under resources in development', () => {
    const root = temp();
    const dir = join(root, 'resources', 'bundled-python', 'linux-x64');
    const executable = join(dir, 'bin', 'python3');
    mkdirSync(join(dir, 'bin'), { recursive: true });
    writeFileSync(executable, 'python');

    expect(bundledPython({ packaged: false, appPath: root, platform: 'linux', arch: 'x64' })).toEqual({
      dir,
      executable,
      pathDir: join(dir, 'bin'),
    });
  });

  it('puts the interpreter first on PATH and points SPECJEV_PYTHON at it', () => {
    const root = temp();
    const dir = join(root, 'bundled-python', 'win32-x64');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'python.exe'), 'python');

    const env: NodeJS.ProcessEnv = { PATH: ['C:\\Windows', 'C:\\Tools'].join(delimiter) };
    const executable = installBundledPython(env, {
      packaged: true,
      resourcesPath: root,
      platform: 'win32',
      arch: 'x64',
    });

    expect(executable).toBe(join(dir, 'python.exe'));
    expect(env.SPECJEV_PYTHON).toBe(executable);
    expect(env.PATH?.startsWith(`${dir}${delimiter}`)).toBe(true);
    expect(env.PYTHONUTF8).toBe('1');
    expect(env.PYTHONIOENCODING).toBe('utf-8');
  });

  it('leaves PATH alone when the person set SPECJEV_PYTHON', () => {
    const env: NodeJS.ProcessEnv = { PATH: 'C:\\Windows', SPECJEV_PYTHON: 'C:\\Python\\python.exe' };

    expect(installBundledPython(env, { packaged: true, resourcesPath: '/none', platform: 'win32' })).toBe(
      'C:\\Python\\python.exe'
    );
    expect(env.PATH).toBe('C:\\Windows');
  });
});
