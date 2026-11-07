import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/unused' },
}));

import { checkEnvironment, chromiumCandidates } from '@process/startup/environmentCheck';
import type { EnvironmentReport } from '@/common/types/environment';

const bundled = {
  dir: 'C:\\app\\resources\\bundled-python\\win32-x64',
  executable: 'C:\\app\\resources\\bundled-python\\win32-x64\\python.exe',
  pathDir: 'C:\\app\\resources\\bundled-python\\win32-x64',
};

const dependency = (report: EnvironmentReport, id: string) =>
  report.dependencies.find((candidate) => candidate.id === id);

describe('the components the built-in skills need', () => {
  it('reports the bundled Python and its packages when both probes answer', async () => {
    const probe = vi.fn(async (_command: string, args: string[]) => {
      if (args[1].includes('sys.version')) return { ok: true, stdout: '3.12.16' };
      if (args[1].includes('import docx')) return { ok: true, stdout: '1.2.0' };
      return { ok: false, stdout: '' };
    });
    const edge = chromiumCandidates('win32', {})[1];
    const exists = vi.fn((file: string) => file === edge);

    const report = await checkEnvironment({
      platform: 'win32',
      arch: 'x64',
      env: {},
      exists,
      probe,
      bundled,
    });

    expect(report.pythonPath).toBe(bundled.executable);
    expect(dependency(report, 'python')).toEqual({
      id: 'python',
      ok: true,
      source: 'bundled',
      detail: '3.12.16',
    });
    expect(dependency(report, 'pythonDocx')).toEqual({
      id: 'pythonDocx',
      ok: true,
      source: 'bundled',
      detail: '1.2.0',
    });
    expect(dependency(report, 'chromium')).toEqual({
      id: 'chromium',
      ok: true,
      detail: edge,
    });
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('marks python-docx missing without hiding the Python runtime', async () => {
    const probe = vi.fn(async (_command: string, args: string[]) =>
      args[1].includes('sys.version') ? { ok: true, stdout: '3.11.9' } : { ok: false, stdout: '' }
    );

    const report = await checkEnvironment({
      platform: 'win32',
      arch: 'x64',
      env: { SPECJEV_PYTHON: 'C:\\Python\\python.exe' },
      exists: () => false,
      probe,
    });

    expect(dependency(report, 'python')).toEqual({
      id: 'python',
      ok: true,
      source: 'system',
      detail: '3.11.9',
    });
    expect(dependency(report, 'pythonDocx')).toEqual({ id: 'pythonDocx', ok: false, source: 'system' });
    expect(dependency(report, 'chromium')?.ok).toBe(false);
  });

  it('does not probe python-docx when Python itself is missing', async () => {
    const probe = vi.fn(async () => ({ ok: false, stdout: '' }));

    const report = await checkEnvironment({
      platform: 'linux',
      arch: 'x64',
      env: { SPECJEV_PYTHON: '/usr/bin/python3' },
      exists: () => false,
      probe,
      bundled,
    });

    expect(dependency(report, 'python')?.ok).toBe(false);
    expect(dependency(report, 'pythonDocx')).toEqual({ id: 'pythonDocx', ok: false, source: 'system' });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('uses SPECJEV_CHROMIUM before the browsers installed on Windows', () => {
    const candidates = chromiumCandidates('win32', {
      SPECJEV_CHROMIUM: 'D:\\Browsers\\chrome.exe',
      LOCALAPPDATA: 'C:\\Users\\someone\\AppData\\Local',
    });

    expect(candidates[0]).toBe('D:\\Browsers\\chrome.exe');
    expect(candidates).toContain('C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe');
    expect(candidates).toContain('C:\\Users\\someone\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe');
  });
});
