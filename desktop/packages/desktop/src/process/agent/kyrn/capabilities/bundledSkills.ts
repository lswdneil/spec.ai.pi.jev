import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

/**
 * The skills this app adds to the ones spec.jev ships with are files beside the harness, but pi loads a skill only
 * from its own folders (`<agentDir>/skills`, `.spec.jev/skills` of the project) or from the paths in its
 * `settings.json` `skills` list: a folder under `judge/skills` is listed in the settings page and never offered to
 * the model. This puts the ones `scripts/kyrn/bundle-harness.mjs` added on that list, so they load in every
 * conversation.
 *
 * The build names them in `builtin-skills.json` beside the harness; nothing is registered when that file is absent
 * (a checkout, where the build has not run). Paths of an app that moved are dropped, not kept: an entry of this
 * folder belongs to that build, and the current build writes its own. Paths of anybody else's skills are left alone.
 */
const MANIFEST = 'builtin-skills.json';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A skill's folder name: what `SKILL.md` and the settings page accept, and nothing that leaves the folder. */
const isSkillFolder = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);

function readManifest(file: string): string[] {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!isRecord(parsed) || !Array.isArray(parsed.skills)) return [];
    return parsed.skills.filter(isSkillFolder);
  } catch {
    return [];
  }
}

function readSettings(file: string): Json | undefined {
  if (!existsSync(file)) return {};
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    console.warn(`[spec.jev] cannot read ${file}:`, error);
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed)) return parsed;
    console.warn(`[spec.jev] ${file}: expected a JSON object; not registering the skills this app adds`);
  } catch (error) {
    console.warn(`[spec.jev] ${file}: invalid JSON; not registering the skills this app adds`, error);
  }
  return undefined;
}

/** Puts the named skill folders under `folder` on pi's list, replacing what a build before put there. */
function registerSkills(agentDir: string, folder: string, names: readonly string[]): void {
  const wanted = names.map((name) => join(folder, name)).filter((path) => existsSync(join(path, 'SKILL.md')));
  if (wanted.length === 0) return;

  const file = join(agentDir, 'settings.json');
  const document = readSettings(file);
  if (!document) return;

  const current = Array.isArray(document.skills) ? document.skills.filter((path) => typeof path === 'string') : [];
  const root = resolve(folder);
  const ours = (path: string): boolean => {
    const full = resolve(path);
    return full === root || full.startsWith(`${root}${sep}`);
  };
  const skills = [...current.filter((path) => !ours(path)), ...wanted];
  if (skills.length === current.length && skills.every((path, index) => path === current[index])) return;

  // Only the list changes; what is written by hand elsewhere in the file keeps its value.
  document.skills = skills;
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.warn(`[spec.jev] cannot write ${file}:`, error);
  }
}

/** @param harnessDir the folder holding `spec.jev/` and `builtin-skills.json`, as the packaged app carries them */
export function seedBundledSkills(agentDir: string, harnessDir: string): void {
  const names = readManifest(join(harnessDir, MANIFEST));
  if (names.length === 0) return;
  registerSkills(agentDir, join(harnessDir, 'spec.jev', 'judge', 'skills'), names);
}

/**
 * Registers the skills in a folder this app ships, for a checkout whose harness does not carry them and has no
 * `builtin-skills.json`: `resources/builtin-skills` beside the app.
 */
export function seedSkillsFromFolder(agentDir: string, folder: string): void {
  let names: string[];
  try {
    names = readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isSkillFolder(entry.name))
      .map((entry) => entry.name)
      .toSorted();
  } catch {
    return;
  }
  if (names.length === 0) return;
  registerSkills(agentDir, folder, names);
}
