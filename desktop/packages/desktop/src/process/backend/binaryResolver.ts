/**
 * Resolve the aioncore binary path.
 *
 * Search order:
 *  1. MU_BACKEND_BIN env override (path, resolved to absolute)
 *  2. Bundled with app (production) or in the checkout's `resources` (development)
 *  3. System PATH
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const BINARY_NAME = 'aioncore';
const BIN_ENV_VAR = 'MU_BACKEND_BIN';
const MAX_DIR_ENTRIES = 20;
const MAX_LOOKUP_TEXT_LENGTH = 1000;

type ResolveBinaryPathOptions = {
  /** Electron's resources directory. Defaults to `process.resourcesPath`. */
  resourcesPath?: string;
  /** The app directory. A checkout keeps its bundled binaries below `<appPath>/resources`. */
  appPath?: string;
  /** Fallback checkout root. Defaults to `process.cwd()`. */
  cwd?: string;
};

type BackendBinaryResolveDiagnostics = {
  envOverridePath?: string;
  envOverrideExists?: boolean;
  resourcesPath?: string;
  runtimeKey: string;
  binaryName: string;
  checkedBundledPath?: string;
  checkedBundledPaths?: string[];
  bundledDirExists?: boolean;
  runtimeDirExists?: boolean;
  resourcesDirEntries?: string[];
  runtimeDirEntries?: string[];
  pathLookupCommand: string;
  pathLookupResult?: string;
  pathLookupError?: string;
};

class BackendBinaryResolveError extends Error {
  readonly diagnostics: BackendBinaryResolveDiagnostics;

  constructor(message: string, diagnostics: BackendBinaryResolveDiagnostics) {
    super(message);
    this.name = 'BackendBinaryResolveError';
    this.diagnostics = diagnostics;
  }
}

function getBinaryName(): string {
  return process.platform === 'win32' ? `${BINARY_NAME}.exe` : BINARY_NAME;
}

function getRuntimeKey(): string {
  return `${process.platform}-${process.arch}`;
}

function listDirEntries(dirPath: string): string[] | undefined {
  try {
    return readdirSync(dirPath, { withFileTypes: true })
      .slice(0, MAX_DIR_ENTRIES)
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`);
  } catch {
    return undefined;
  }
}

function trimLookupText(text: string): string {
  return text.trim().slice(0, MAX_LOOKUP_TEXT_LENGTH);
}

/**
 * Resolve the aioncore binary path.
 * Returns the absolute path to the binary, or throws if not found.
 */
export function resolveBinaryPath(options: ResolveBinaryPathOptions = {}): string {
  const runtimeKey = getRuntimeKey();
  const binaryName = getBinaryName();
  const diagnostics: BackendBinaryResolveDiagnostics = {
    runtimeKey,
    binaryName,
    pathLookupCommand: process.platform === 'win32' ? `where ${BINARY_NAME}` : `which ${BINARY_NAME}`,
  };

  const override = envOverridePath(diagnostics);
  if (override) return override;

  const bundled = bundledPath(runtimeKey, binaryName, options, diagnostics);
  if (bundled) return bundled;

  const fromPath = resolveFromSystemPATH(diagnostics);
  if (fromPath) return fromPath;

  throw new BackendBinaryResolveError(
    `Cannot find "${BINARY_NAME}" binary. Checked bundled location and system PATH.`,
    diagnostics
  );
}

/**
 * Honor the MU_BACKEND_BIN env override.
 * The value is resolved to an absolute path (relative to process.cwd) so it
 * survives the backend launcher spawning with a different working directory.
 * Returns the path when it points at an existing file. When the variable is
 * set but the file is missing, throws so a typo fails loudly instead of
 * silently falling back to the bundled or PATH binary.
 */
function envOverridePath(diagnostics: BackendBinaryResolveDiagnostics): string | null {
  const raw = process.env[BIN_ENV_VAR]?.trim();
  if (!raw) return null;

  const absolute = resolve(raw);
  diagnostics.envOverridePath = absolute;
  const exists = existsSync(absolute);
  diagnostics.envOverrideExists = exists;
  if (exists) return absolute;

  throw new BackendBinaryResolveError(
    `${BIN_ENV_VAR} is set to "${raw}" but no file exists at "${absolute}".`,
    diagnostics
  );
}

/**
 * Check bundled binaries. The packaged app keeps them under
 * `<resources>/bundled-aioncore`; a checkout keeps the same tree under
 * `<appPath>/resources` and `<cwd>/resources`, the layout the other bundled
 * resources (moli, MCP servers) use in development.
 */
function bundledPath(
  runtimeKey: string,
  binaryName: string,
  options: ResolveBinaryPathOptions,
  diagnostics: BackendBinaryResolveDiagnostics
): string | null {
  const resourcesPath =
    options.resourcesPath ?? (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const roots: string[] = [];
  if (resourcesPath) {
    diagnostics.resourcesPath = resourcesPath;
    roots.push(resourcesPath);
  }
  for (const root of [options.appPath, options.cwd ?? process.cwd()]) {
    if (root) roots.push(join(root, 'resources'));
  }

  const candidates = [...new Set(roots)].map((root) =>
    join(root, 'bundled-aioncore', runtimeKey, binaryName)
  );
  if (candidates.length === 0) return null;

  diagnostics.checkedBundledPath = candidates[0];
  diagnostics.checkedBundledPaths = candidates;

  if (resourcesPath) {
    const packagedDir = join(resourcesPath, 'bundled-aioncore');
    const packagedRuntimeDir = join(packagedDir, runtimeKey);
    diagnostics.bundledDirExists = existsSync(packagedDir);
    diagnostics.runtimeDirExists = existsSync(packagedRuntimeDir);
    diagnostics.resourcesDirEntries = listDirEntries(resourcesPath);
    diagnostics.runtimeDirEntries = listDirEntries(packagedRuntimeDir);
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Try to find the binary on the system PATH.
 */
function resolveFromSystemPATH(diagnostics: BackendBinaryResolveDiagnostics): string | null {
  try {
    const result = execSync(diagnostics.pathLookupCommand, { encoding: 'utf-8', timeout: 5000 }).trim();
    diagnostics.pathLookupResult = trimLookupText(result);
    const firstMatch = result.split(/\r?\n/).find((line) => line.trim());
    if (firstMatch && existsSync(firstMatch.trim())) return firstMatch.trim();
  } catch (error) {
    diagnostics.pathLookupError = error instanceof Error ? trimLookupText(error.message) : String(error);
    return null;
  }
  return null;
}

export type { BackendBinaryResolveDiagnostics };
