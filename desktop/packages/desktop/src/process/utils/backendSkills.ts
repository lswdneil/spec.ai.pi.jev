/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { cpSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';

/**
 * Skills spec.jev adds to the backend's corpus.
 *
 * AionCore carries its built-in skills inside its own binary; the skills this app ships beside the harness are not
 * part of that corpus. The backend scans `<data>/builtin-skills` at startup, so a missing folder is a skill that
 * never reaches the settings page or a conversation. These names are copied in before the backend starts, which
 * makes them built in on a fresh machine as well.
 */
export const APP_ADDED_SKILLS = ['agent-desktop', 'stack-diagram'] as const;

/**
 * Skills the backend injects into every conversation. AionCore treats a skill under `auto-inject/` in its corpus as
 * auto-injected; the others stay opt-in.
 */
const AUTO_INJECT_SKILLS: ReadonlySet<string> = new Set(['agent-desktop']);

function corpusPath(corpusDir: string, name: string): string {
  return AUTO_INJECT_SKILLS.has(name) ? path.join(corpusDir, 'auto-inject', name) : path.join(corpusDir, name);
}

/**
 * Copies the named skills from `sourceDir` into the backend's corpus when they are absent.
 *
 * A folder that is already there is left untouched: it may be the person's copy, edited after the first start. An
 * older top-level copy of an auto-injected skill is moved to `auto-inject/` instead of being copied again, so an
 * upgrade keeps the person's edits and does not leave two skills with the same name. A failure to place one skill
 * never blocks the others, nor the app.
 *
 * @returns the names actually placed
 */
export function seedBackendSkills(
  sourceDir: string,
  corpusDir: string,
  names: readonly string[] = APP_ADDED_SKILLS
): string[] {
  const copied: string[] = [];
  for (const name of names) {
    const from = path.join(sourceDir, name);
    const to = corpusPath(corpusDir, name);
    if (!existsSync(path.join(from, 'SKILL.md')) || existsSync(to)) continue;
    try {
      const legacy = path.join(corpusDir, name);
      if (AUTO_INJECT_SKILLS.has(name) && existsSync(legacy)) {
        mkdirSync(path.dirname(to), { recursive: true });
        renameSync(legacy, to);
        copied.push(name);
        continue;
      }
      mkdirSync(path.dirname(to), { recursive: true });
      cpSync(from, to, { recursive: true });
      copied.push(name);
    } catch (error) {
      console.warn(`[spec.jev] could not add the ${name} skill to the backend corpus:`, error);
    }
  }
  return copied;
}
