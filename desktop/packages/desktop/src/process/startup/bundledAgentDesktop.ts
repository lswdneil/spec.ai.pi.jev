import { existsSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

type BundledAgentDesktopOptions = {
  packaged?: boolean;
  resourcesPath?: string;
  appPath?: string;
  platform?: NodeJS.Platform;
  arch?: string;
};

export type BundledAgentDesktop = {
  /** The folder the build staged, for logs and diagnostics. */
  dir: string;
  /** The executable itself. */
  executable: string;
};

/**
 * The agent-desktop CLI that ships inside the app, if this build carries one.
 *
 * `<resources>/bundled-agent-desktop/<platform>-<arch>/` in a packaged app; the same tree under
 * `desktop/resources` in a checkout. The built-in skill has the agent call `agent-desktop`, and the app
 * puts this folder first on PATH before any agent shell inherits the environment. Nothing is downloaded
 * on the person's machine.
 */
export function bundledAgentDesktopPath(options: BundledAgentDesktopOptions = {}): BundledAgentDesktop | undefined {
  const platform = options.platform ?? process.platform;
  if (platform !== 'win32' && platform !== 'darwin' && platform !== 'linux') return undefined;
  const arch = options.arch ?? process.arch;
  const packaged = options.packaged ?? app.isPackaged;
  const appPath = options.appPath ?? app.getAppPath();
  const roots = packaged
    ? [options.resourcesPath ?? process.resourcesPath]
    : [appPath, process.cwd(), path.resolve(appPath, '..', '..')];
  const runtimeKey = `${platform}-${arch}`;
  const name = platform === 'win32' ? 'agent-desktop.exe' : 'agent-desktop';

  for (const root of roots) {
    const dir = path.join(
      root,
      ...(packaged ? ['bundled-agent-desktop'] : ['resources', 'bundled-agent-desktop']),
      runtimeKey
    );
    const executable = path.join(dir, name);
    if (existsSync(executable)) return { dir, executable };
  }
  return undefined;
}

/**
 * Puts the bundled agent-desktop folder first on PATH and records the executable in
 * `SPECJEV_AGENT_DESKTOP`, so every agent-spawned shell resolves `agent-desktop` without an install.
 * Returns the executable it used, if any.
 */
export function installBundledAgentDesktop(
  env: NodeJS.ProcessEnv = process.env,
  options: BundledAgentDesktopOptions = {}
): string | undefined {
  if (env.SPECJEV_AGENT_DESKTOP) return env.SPECJEV_AGENT_DESKTOP;

  const runtime = bundledAgentDesktopPath(options);
  if (!runtime) return undefined;

  const pathKey = Object.keys(env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  const entries = (env[pathKey] ?? '').split(path.delimiter).filter(Boolean);
  const present = entries.some(
    (entry) => path.resolve(entry).toLowerCase() === path.resolve(runtime.dir).toLowerCase()
  );
  if (!present) env[pathKey] = [runtime.dir, ...entries].join(path.delimiter);

  env.SPECJEV_AGENT_DESKTOP = runtime.executable;
  // agent-desktop looks for its macOS helper beside the CLI; naming it here keeps a bundled pair together.
  if ((options.platform ?? process.platform) === 'darwin') {
    const helper = path.join(runtime.dir, 'agent-desktop-macos-helper');
    if (existsSync(helper)) env.AGENT_DESKTOP_MACOS_HELPER_PATH ??= helper;
  }
  return runtime.executable;
}
