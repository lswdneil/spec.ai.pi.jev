/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Skills spec.jev adds to the backend's corpus.
 *
 * AionCore carries its built-in skills inside its own binary; the skills this app ships beside the harness are not
 * part of that corpus. The backend scans `<data>/builtin-skills` at startup, so a missing folder is a skill that
 * never reaches the settings page or a conversation. These names are copied in before the backend starts, which
 * makes them built in on a fresh machine as well.
 */
export const APP_ADDED_SKILLS = ['stack-diagram'] as const;

/**
 * Copies the named skills from `sourceDir` into the backend's corpus when they are absent.
 *
 * A folder that is already there is left untouched: it may be the person's copy, edited after the first start. A
 * failure to copy one skill never blocks the others, nor the app.
 *
 * @returns the names actually copied
 */
export function seedBackendSkills(
  sourceDir: string,
  corpusDir: string,
  names: readonly string[] = APP_ADDED_SKILLS
): string[] {
  const copied: string[] = [];
  for (const name of names) {
    const from = path.join(sourceDir, name);
    const to = path.join(corpusDir, name);
    if (!existsSync(path.join(from, 'SKILL.md')) || existsSync(to)) continue;
    try {
      mkdirSync(corpusDir, { recursive: true });
      cpSync(from, to, { recursive: true });
      copied.push(name);
    } catch (error) {
      console.warn(`[spec.jev] could not add the ${name} skill to the backend corpus:`, error);
    }
  }
  return copied;
}
