import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * spec.jev's folders and settings, decided as the launcher decides them (`packages/kyrn-judge/src/naming.ts`),
 * so both sides agree on where things are.
 *
 * Module, channel, i18n-key and stored event names (`kyrn.*`) were not renamed: they are not shown to anyone,
 * and the event names are already written in session and activity files.
 */

/** `SPECJEV_<name>`. */
export function muEnv(name: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env[`SPECJEV_${name}`] || undefined;
}

/** `~/.spec.jev`. */
export function muHome(home: string = homedir()): string {
  return join(home, '.spec.jev');
}

/**
 * spec.jev's agent folder, decided as its launcher decides it (`agentDirFor` in `kyrn/bin/mu.mjs`), so the app
 * reads the files the agent it runs reads: `SPECJEV_AGENT_DIR`, else `SPECJEV_CODING_AGENT_DIR`, else
 * `agent` in spec.jev's home.
 */
export function muAgentDir(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  return muEnv('AGENT_DIR', env) || muEnv('CODING_AGENT_DIR', env) || join(muHome(home), 'agent');
}

/** The judgment configuration of an agent directory. */
export function configPath(agentDir: string): string {
  return join(agentDir, 'spec.jev.json');
}
