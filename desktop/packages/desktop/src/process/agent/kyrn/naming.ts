import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * The project has had three names: KYRN until 2026-09-21, spec.jev until 2026-10-21, spec.jev since. The same three
 * rules as the harness (`packages/kyrn-judge/src/naming.ts`), so both sides agree on where things are.
 *
 * Module, channel, i18n-key and stored event names (`kyrn.*`) were not renamed: they are not shown to anyone,
 * and the event names are already written in session and activity files.
 */

/** `SPECJEV_<name>`, or the `MU_<name>` / `KYRN_<name>` spelling from before a rename. */
export function muEnv(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[`SPECJEV_${name}`] || env[`MU_${name}`] || env[`KYRN_${name}`] || undefined;
}

/**
 * `~/.spec.jev`, or the older home this machine already has (~/.spec.jev, then ~/.kyrn). Nothing here creates a new
 * home beside an old one: that would split the login, the session list and the desktop's session mappings.
 */
export function muHome(home: string = homedir()): string {
  const candidates = ['.spec.jev', '.mu', '.kyrn'].map((name) => join(home, name));
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

/**
 * spec.jev's agent folder, decided as its launcher decides it (`agentDirFor` in `kyrn/bin/mu.mjs`), so the app
 * reads the files the agent it runs reads: `SPECJEV_AGENT_DIR`, else `MU_AGENT_DIR`, else pi's
 * `MU_CODING_AGENT_DIR`, else `agent` in spec.jev's home.
 */
export function muAgentDir(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  return muEnv('AGENT_DIR', env) || muEnv('CODING_AGENT_DIR', env) || join(muHome(home), 'agent');
}

/**
 * The judgment configuration of an agent directory: `spec.jev.json`, or the `mu.json` / `kyrn.json` a machine
 * already has. Saving goes to the file that was read, so there is never a second file shadowing the first.
 */
export function configPath(agentDir: string): string {
  const candidates = ['spec.jev.json', 'mu.json', 'kyrn.json'].map((name) => join(agentDir, name));
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}
