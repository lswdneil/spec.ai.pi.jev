import { existsSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

type BundledMoliOptions = {
  packaged?: boolean;
  resourcesPath?: string;
  appPath?: string;
  platform?: NodeJS.Platform;
  arch?: string;
};

/**
 * The moli that ships inside the app, if this build carries one. The app puts it under
 * `<resources>/bundled-moli/<platform>-<arch>/moli[.exe]`; in a checkout the same tree is under
 * `desktop/resources`. The harness reads SPECJEV_MOLI, so setting it here gives the agent a
 * working fallback without asking the person to install moli first.
 */
export function bundledMoliPath(options: BundledMoliOptions = {}): string | undefined {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  if (platform !== 'win32' && platform !== 'linux') return undefined;
  const packaged = options.packaged ?? app.isPackaged;
  const appPath = options.appPath ?? app.getAppPath();
  const roots = packaged
    ? [options.resourcesPath ?? process.resourcesPath]
    : [appPath, process.cwd(), path.resolve(appPath, '..', '..')];
  const folder = path.join(`${platform}-${arch}`, platform === 'win32' ? 'moli.exe' : 'moli');
  for (const root of roots) {
    const binary = path.join(root, ...(packaged ? ['bundled-moli'] : ['resources', 'bundled-moli']), folder);
    if (existsSync(binary)) return binary;
  }
  return undefined;
}

/** Sets SPECJEV_MOLI to the bundled binary unless the person or the environment already chose one. */
export function installBundledMoli(
  env: NodeJS.ProcessEnv = process.env,
  options: BundledMoliOptions = {}
): string | undefined {
  if (env.SPECJEV_MOLI) return env.SPECJEV_MOLI;
  const binary = bundledMoliPath(options);
  if (binary) env.SPECJEV_MOLI = binary;
  return binary;
}
