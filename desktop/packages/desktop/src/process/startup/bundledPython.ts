import { existsSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

type BundledPythonOptions = {
  packaged?: boolean;
  resourcesPath?: string;
  appPath?: string;
  platform?: NodeJS.Platform;
  arch?: string;
};

export type BundledPython = {
  /** The folder the build staged, for logs and diagnostics. */
  dir: string;
  /** The interpreter itself. */
  executable: string;
  /** The folder to put on PATH (`dir` on Windows, `dir/bin` elsewhere). */
  pathDir: string;
};

/**
 * The portable Python that ships inside the app, if this build carries one. The app puts it under
 * `<resources>/bundled-python/<platform>-<arch>/`; in a checkout the same tree is under
 * `desktop/resources`. The docx skill and stack-diagram run Python scripts, and Windows has no
 * interpreter by default (the `python` name is a Store alias until someone installs one), so the
 * app supplies its own and puts it first on PATH.
 */
export function bundledPython(options: BundledPythonOptions = {}): BundledPython | undefined {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const packaged = options.packaged ?? app.isPackaged;
  const appPath = options.appPath ?? app.getAppPath();
  const roots = packaged
    ? [options.resourcesPath ?? process.resourcesPath]
    : [appPath, process.cwd(), path.resolve(appPath, '..', '..')];
  const runtimeKey = `${platform}-${arch}`;

  for (const root of roots) {
    const dir = path.join(root, ...(packaged ? ['bundled-python'] : ['resources', 'bundled-python']), runtimeKey);
    const pathDir = platform === 'win32' ? dir : path.join(dir, 'bin');
    const executable = path.join(pathDir, platform === 'win32' ? 'python.exe' : 'python3');
    if (existsSync(executable)) return { dir, executable, pathDir };
  }
  return undefined;
}

/**
 * Puts the bundled interpreter first on PATH unless the person already pointed SPECJEV_PYTHON at
 * one, so every agent-spawned shell resolves `python` and `python3` to a runtime that has
 * python-docx. Returns the interpreter it used, if any.
 */
export function installBundledPython(
  env: NodeJS.ProcessEnv = process.env,
  options: BundledPythonOptions = {}
): string | undefined {
  // Python on Windows otherwise writes the console code page, which mangles Chinese document text
  // in the tool output the agent reads back.
  env.PYTHONUTF8 ??= '1';
  env.PYTHONIOENCODING ??= 'utf-8';
  if (env.SPECJEV_PYTHON) return env.SPECJEV_PYTHON;

  const runtime = bundledPython(options);
  if (!runtime) return undefined;

  const pathKey = Object.keys(env).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  const entries = (env[pathKey] ?? '').split(path.delimiter).filter(Boolean);
  const present = entries.some(
    (entry) => path.resolve(entry).toLowerCase() === path.resolve(runtime.pathDir).toLowerCase()
  );
  if (!present) env[pathKey] = [runtime.pathDir, ...entries].join(path.delimiter);

  env.SPECJEV_PYTHON = runtime.executable;
  return runtime.executable;
}
