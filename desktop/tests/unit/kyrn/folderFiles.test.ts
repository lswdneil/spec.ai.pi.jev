/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { authorizeFolder, listFolder } from '@process/agent/kyrn/folderFiles';

const dirs: string[] = [];

async function makeFixture() {
  const base = await mkdtemp(join(tmpdir(), 'specjev-folder-files-'));
  dirs.push(base);
  const root = join(base, 'project');
  const outside = join(base, 'outside');
  const store = join(base, 'sessions');
  await Promise.all([mkdir(root), mkdir(outside), mkdir(store)]);
  await writeFile(
    join(store, '00000000-0000-0000-0000-000000000001.json'),
    JSON.stringify({ cwd: root, file: '/sessions/native.json' })
  );
  return { root, outside, store };
}

afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe('KyRN folder files', () => {
  it('authorizes a folder recorded by a native session and lists it', async () => {
    const { root, store } = await makeFixture();
    await writeFile(join(root, 'notes.txt'), 'hello');

    const authorized = await authorizeFolder(store, root);
    const listing = await listFolder(authorized, '');

    expect(authorized).toBe(await realpath(root));
    expect(listing.entries).toEqual([{ name: 'notes.txt', path: 'notes.txt', kind: 'file' }]);
  });

  it('rejects an absolute folder that no native session owns', async () => {
    const { outside, store } = await makeFixture();

    await expect(authorizeFolder(store, outside)).rejects.toMatchObject({
      code: 'invalid',
      message: 'Folder is not attached to a session',
    });
  });

  it("authorizes a folder spec.jev's own session header names, with no ACP record", async () => {
    const { root, store } = await makeFixture();
    const emptyStore = join(dirname(store), 'acp-sessions-empty');
    await mkdir(emptyStore, { recursive: true });
    const agentDir = join(dirname(store), 'agent');
    const sessions = join(agentDir, 'sessions', '--project--');
    await mkdir(sessions, { recursive: true });
    await writeFile(
      join(sessions, '2026-11-10T06-09-37-373Z_session.jsonl'),
      `${JSON.stringify({ type: 'session', version: 3, cwd: root })}\n`
    );

    await expect(authorizeFolder(emptyStore, root, agentDir)).resolves.toBe(await realpath(root));
    await expect(authorizeFolder(emptyStore, root)).rejects.toMatchObject({
      code: 'invalid',
      message: 'Folder is not attached to a session',
    });
  });

  it('rejects following an in-folder symlink to a directory outside the root', async () => {
    const { root, outside, store } = await makeFixture();
    const link = join(root, 'escape');
    await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');

    const authorized = await authorizeFolder(store, root);
    await expect(listFolder(authorized, 'escape')).rejects.toMatchObject({
      code: 'invalid',
      message: 'The path leaves the folder',
    });
  });
});
