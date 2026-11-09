import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/unused' },
}));

import { bundledAgentDesktopPath, installBundledAgentDesktop } from '@process/startup/bundledAgentDesktop';

const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'specjev-agent-desktop-'));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe('the agent-desktop bundled with the app', () => {
  it('finds the packaged executable under resources/bundled-agent-desktop', () => {
    const root = temp();
    const binary = join(root, 'bundled-agent-desktop', 'win32-x64', 'agent-desktop.exe');
    mkdirSync(join(root, 'bundled-agent-desktop', 'win32-x64'), { recursive: true });
    writeFileSync(binary, 'agent-desktop');

    expect(bundledAgentDesktopPath({ packaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })).toEqual({
      dir: join(root, 'bundled-agent-desktop', 'win32-x64'),
      executable: binary,
    });
  });

  it('finds the checkout copy under resources in development', () => {
    const root = temp();
    const binary = join(root, 'resources', 'bundled-agent-desktop', 'linux-x64', 'agent-desktop');
    mkdirSync(join(root, 'resources', 'bundled-agent-desktop', 'linux-x64'), { recursive: true });
    writeFileSync(binary, 'agent-desktop');

    expect(bundledAgentDesktopPath({ packaged: false, appPath: root, platform: 'linux', arch: 'x64' })).toEqual({
      dir: join(root, 'resources', 'bundled-agent-desktop', 'linux-x64'),
      executable: binary,
    });
  });

  it('leaves a person-set SPECJEV_AGENT_DESKTOP alone, and puts ours first on PATH when empty', () => {
    const root = temp();
    const binary = join(root, 'bundled-agent-desktop', 'win32-x64', 'agent-desktop.exe');
    mkdirSync(join(root, 'bundled-agent-desktop', 'win32-x64'), { recursive: true });
    writeFileSync(binary, 'agent-desktop');

    const chosen = { SPECJEV_AGENT_DESKTOP: 'C:\\tools\\agent-desktop.exe', Path: 'C:\\Windows' };
    expect(
      installBundledAgentDesktop(chosen, { packaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })
    ).toBe(chosen.SPECJEV_AGENT_DESKTOP);
    expect(chosen.Path).toBe('C:\\Windows');

    const empty: NodeJS.ProcessEnv = { Path: 'C:\\Windows' };
    expect(
      installBundledAgentDesktop(empty, { packaged: true, resourcesPath: root, platform: 'win32', arch: 'x64' })
    ).toBe(binary);
    expect(empty.SPECJEV_AGENT_DESKTOP).toBe(binary);
    expect(empty.Path?.split(delimiter)[0]).toBe(resolve(join(root, 'bundled-agent-desktop', 'win32-x64')));
  });

  it('names the macOS helper beside the CLI', () => {
    const root = temp();
    const dir = join(root, 'bundled-agent-desktop', 'darwin-arm64');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'agent-desktop'), 'agent-desktop');
    writeFileSync(join(dir, 'agent-desktop-macos-helper'), 'helper');

    const env: NodeJS.ProcessEnv = {};
    expect(
      installBundledAgentDesktop(env, { packaged: true, resourcesPath: root, platform: 'darwin', arch: 'arm64' })
    ).toBe(join(dir, 'agent-desktop'));
    expect(env.AGENT_DESKTOP_MACOS_HELPER_PATH).toBe(join(dir, 'agent-desktop-macos-helper'));
  });
});
