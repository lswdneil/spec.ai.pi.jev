import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import type { EnvironmentDependency, EnvironmentReport } from '@/common/types/environment';
import { bundledPython, type BundledPython } from './bundledPython';

const execFileAsync = promisify(execFile);
const PROBE_TIMEOUT_MS = 5000;

type ProbeResult = { ok: boolean; stdout: string };
type EnvironmentProbe = (command: string, args: string[]) => Promise<ProbeResult>;

export type CheckEnvironmentOptions = {
  platform?: NodeJS.Platform;
  arch?: string;
  env?: NodeJS.ProcessEnv;
  exists?: (file: string) => boolean;
  probe?: EnvironmentProbe;
  /** Skip resolution: check this interpreter instead. */
  python?: string;
  bundled?: BundledPython;
};

const probeInterpreter: EnvironmentProbe = async (command, args) => {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: PROBE_TIMEOUT_MS,
      windowsHide: true,
      encoding: 'utf8',
    });
    return { ok: true, stdout: stdout.trim() };
  } catch {
    // A missing interpreter, a Store alias stub and a broken install all look the same here: the
    // skill would fail the same way, so report it as unavailable rather than guessing why.
    return { ok: false, stdout: '' };
  }
};

/**
 * Where pptx and pdf find a Chromium: an explicit override first, then the stock install paths
 * (Edge ships with Windows 10/11), then the usual Linux/macOS locations.
 */
export function chromiumCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.SPECJEV_CHROMIUM?.trim();
  const fromEnv = configured ? [configured] : [];
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA ?? '';
    return [
      ...fromEnv,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ...(localAppData
        ? [
            `${localAppData}\\Google\\Chrome\\Application\\chrome.exe`,
            `${localAppData}\\Microsoft\\Edge\\Application\\msedge.exe`,
          ]
        : []),
    ];
  }
  if (platform === 'darwin') {
    return [
      ...fromEnv,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return [
    ...fromEnv,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
}

function findChromium(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, exists: (file: string) => boolean) {
  return chromiumCandidates(platform, env).find((candidate) => exists(candidate));
}

/**
 * Checks what the built-in skills need from the machine. Python ships with the app; a build that
 * skipped it falls back to whatever `python` the machine has. Chromium is not bundled — pptx and
 * pdf print through the Edge or Chrome a Windows machine already has.
 */
export async function checkEnvironment(options: CheckEnvironmentOptions = {}): Promise<EnvironmentReport> {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const probe = options.probe ?? probeInterpreter;
  const bundled = options.bundled ?? bundledPython({ platform, arch });
  const python =
    options.python ??
    env.SPECJEV_PYTHON?.trim() ??
    bundled?.executable ??
    (platform === 'win32' ? 'python' : 'python3');
  const source = bundled && python === bundled.executable ? 'bundled' : 'system';
  const dependencies: EnvironmentDependency[] = [];

  const version = await probe(python, ['-c', 'import sys; print(sys.version.split()[0])']);
  dependencies.push({
    id: 'python',
    ok: version.ok,
    source,
    detail: version.ok ? version.stdout : undefined,
  });

  if (version.ok) {
    const docx = await probe(python, ['-c', 'import docx; print(getattr(docx, "__version__", "ok"))']);
    dependencies.push({ id: 'pythonDocx', ok: docx.ok, source, detail: docx.ok ? docx.stdout : undefined });
  } else {
    dependencies.push({ id: 'pythonDocx', ok: false, source });
  }

  const chromium = findChromium(platform, env, exists);
  dependencies.push({ id: 'chromium', ok: Boolean(chromium), detail: chromium });

  return { platform, arch, pythonPath: python, dependencies };
}
