import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  InvalidSessionFileError,
  validateSessionFile,
} from '../../../../../../packages/desktop/src/process/services/nativeHost/sessions/sessionPaths.ts';
import { header, user, writeSession } from './sessionFiles.ts';
import { canSymlink } from '../symlinks.ts';

const linking = canSymlink();
const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'mu-session-paths-')));
const sessionsDir = join(root, 'agent', 'sessions');
const customDir = join(root, 'custom-sessions');
const project = join(root, 'project');
const outside = join(root, 'outside');
for (const dir of [sessionsDir, customDir, project, outside]) mkdirSync(dir, { recursive: true });

const folders = { agentDir: join(root, 'agent'), sessionsDir, customDir };

afterAll(() => rmSync(root, { recursive: true, force: true }));

const sessionIn = (dir: string, id: string): string =>
  writeSession(join(dir, `${id}.jsonl`), [header(id, project), user(`${id}-u`, null, 'hello', 1)]);

describe('validateSessionFile', () => {
  it('accepts a real session in the default or custom roots, including a relative alias to it', async () => {
    const stored = sessionIn(join(sessionsDir, '--project--'), 'stored');
    const custom = sessionIn(customDir, 'custom');
    await expect(validateSessionFile(folders, stored, project)).resolves.toMatchObject({
      file: realpathSync.native(stored),
      header: { id: 'stored' },
    });
    await expect(validateSessionFile(folders, custom, project)).resolves.toMatchObject({
      file: realpathSync.native(custom),
      header: { id: 'custom' },
    });
    await expect(validateSessionFile(folders, relative(project, stored), project)).resolves.toMatchObject({
      file: realpathSync.native(stored),
    });
  });

  it('refuses traversal outside the session roots and a directory named like a session', async () => {
    const escaped = sessionIn(outside, 'escaped');
    await expect(validateSessionFile(folders, escaped, project)).rejects.toBeInstanceOf(InvalidSessionFileError);
    await expect(validateSessionFile(folders, relative(project, escaped), project)).rejects.toThrow(
      /outside spec\.jev's session folders/
    );
    const directory = join(sessionsDir, '--project--', 'directory.jsonl');
    mkdirSync(directory, { recursive: true });
    await expect(validateSessionFile(folders, directory, project)).rejects.toThrow(/Not a regular session file/);
  });

  it('refuses a file whose first line is not a session header', async () => {
    const invalid = join(sessionsDir, '--project--', 'invalid.jsonl');
    writeFileSync(invalid, `${JSON.stringify({ type: 'message', id: 'not-a-header' })}\n`);
    await expect(validateSessionFile(folders, invalid, project)).rejects.toThrow(/Not a valid session file/);
  });

  it.skipIf(!linking)('refuses a symbolic link even when its target is inside a session root', async () => {
    const stored = sessionIn(join(sessionsDir, '--project--'), 'linked-target');
    const link = join(sessionsDir, '--project--', 'linked.jsonl');
    symlinkSync(stored, link, 'file');
    await expect(validateSessionFile(folders, link, project)).rejects.toThrow(/may not be links/);
  });
});
