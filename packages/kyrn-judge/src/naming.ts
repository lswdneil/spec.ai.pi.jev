import { homedir } from "node:os";
import { join } from "node:path";

/**
 * spec.jev keeps everything in one place: `~/.spec.jev`, `spec.jev.json` and variables spelled `SPECJEV_*`.
 * It does not read the homes, files or variable spellings of the projects it grew out of.
 *
 * Names already stored in sessions (`kyrn.decision`, `kyrn.verdict`, ...) were not renamed at all: sessions
 * must still compact, restore and render.
 */
type Env = Readonly<Record<string, string | undefined>>;

/** `SPECJEV_<name>`. */
export function muEnv(name: string, env: Env = process.env): string | undefined {
	return env[`SPECJEV_${name}`] || undefined;
}

export const CONFIG_FILE = "spec.jev.json";

/** `~/.spec.jev`. */
export function muHome(home: string = homedir()): string {
	return join(home, ".spec.jev");
}
