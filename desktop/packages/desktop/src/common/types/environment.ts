/** What the built-in skills need from the machine, as the settings page shows it. */

export type EnvironmentDependencyId = 'python' | 'pythonDocx' | 'chromium';

export type EnvironmentDependency = {
  id: EnvironmentDependencyId;
  ok: boolean;
  /** `bundled` when the app carries it, `system` when it came from the machine. */
  source?: 'bundled' | 'system';
  /** The version or the path that was found. */
  detail?: string;
};

export type EnvironmentReport = {
  /** `process.platform` of the machine that ran the check. */
  platform: string;
  arch: string;
  pythonPath: string;
  dependencies: EnvironmentDependency[];
};
