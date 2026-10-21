import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The project has had three names: KYRN until 2026-09-21, spec.jev until 2026-10-21, and spec.jev since.
 *
 * What a person set up by hand keeps working under the older spellings, newest first: `SPECJEV_*`, then
 * `MU_*`, then `KYRN_*`; `spec.jev.json`, then `mu.json`, then `kyrn.json`; `~/.spec.jev`, then `~/.spec.jev`,
 * then `~/.kyrn`. Nothing is moved: an `~/.spec.jev` that exists keeps being used, so a rename never splits a
 * person's sessions, keys and browser profile in two.
 *
 * Names already stored in sessions (`kyrn.decision`, `kyrn.verdict`, ...) were not renamed at all: old
 * sessions must still compact, restore and render.
 */
type Env = Readonly<Record<string, string | undefined>>;

/** `SPECJEV_<name>`, or the `MU_<name>` / `KYRN_<name>` spelling from before a rename. */
export function muEnv(name: string, env: Env = process.env): string | undefined {
	return env[`SPECJEV_${name}`] || env[`MU_${name}`] || env[`KYRN_${name}`] || undefined;
}

export const CONFIG_FILE = "spec.jev.json";
/** Read when the current file is absent, in this order: the names this project had before. */
export const LEGACY_CONFIG_FILES = ["mu.json", "kyrn.json"] as const;

/**
 * `~/.spec.jev`, or the older home this machine already has. The move is one manual step; until then
 * nothing here creates `~/.spec.jev` next to the old home, which would split the browser profile, the
 * sessions and the sidecar state.
 */
export function muHome(home: string = homedir()): string {
	const candidates = [".spec.jev", ".mu", ".kyrn"].map((name) => join(home, name));
	return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}
