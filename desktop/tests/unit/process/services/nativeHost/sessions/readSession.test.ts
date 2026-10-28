import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fromEntries } from '../../../../../../packages/desktop/src/common/utils/nativeHost/reducer.ts';
import {
  SessionTooLargeError,
  readSessionFile,
  SessionReader,
} from '../../../../../../packages/desktop/src/process/services/nativeHost/sessions/readSession.ts';
import { assistant, header, system, toolOutput, user, writeSession, type Line } from './sessionFiles.ts';

/** A session file read back into a view without a host: pi's branch, tolerant of bad lines, in chunks. */

const FIXTURE = join(__dirname, '..', 'fixtures', 'conversation.session.jsonl');
const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'mu-read-session-')));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('readSessionFile', () => {
  it('reads the recorded conversation into the view its entries give', async () => {
    const lines = readFileSync(FIXTURE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Line);
    const read = await readSessionFile(FIXTURE);
    expect(read.header).toMatchObject({ id: lines[0].id, cwd: lines[0].cwd });
    expect(read.entries).toEqual(lines.slice(1));
    expect(read.lastEntryId).toBe(lines.at(-1)?.id);
    expect(fromEntries(read.entries)).toStrictEqual(fromEntries(lines));
  });

  it('leaves out a corrupt line and a last line pi was still writing', async () => {
    const file = writeSession(join(root, 'bad.jsonl'), [header('s1', '/p'), user('u1', null, 'hello', 1)]);
    appendFileSync(file, '{"type":"message","id":"broken"\n');
    appendFileSync(file, `${JSON.stringify(assistant('a1', 'u1', 'hi', 2))}\n`);
    appendFileSync(file, JSON.stringify(user('u2', 'a1', 'half', 3)).slice(0, 40));
    const read = await readSessionFile(file);
    expect(read.entries.map((entry) => entry.id)).toEqual(['u1', 'a1']);
    expect(read.lastEntryId).toBe('a1');
    expect(fromEntries(read.entries).messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('keeps characters whole where a chunk ends in the middle of one', async () => {
    // Three bytes each, 1.2 MB in all: a chunk of 1 MB ends inside one of them.
    const text = '这'.repeat(400_000);
    const file = writeSession(join(root, 'wide.jsonl'), [header('s1', '/p'), user('u1', null, text, 1)]);
    const read = await readSessionFile(file);
    expect(read.entries).toHaveLength(1);
    expect(fromEntries(read.entries).messages[0]).toMatchObject({ role: 'user', text });
  });

  it('reads a large file in chunks, without holding the process for long at a time', async () => {
    const lines: Line[] = [header('big', '/p')];
    let parent: string | null = null;
    for (let turn = 0; turn < 1000; turn++) {
      const ids = [`u${turn}`, `t${turn}`, `a${turn}`];
      lines.push(user(ids[0], parent, `question ${turn}`, 1));
      lines.push(toolOutput(ids[1], ids[0], 20_000, 1));
      lines.push(assistant(ids[2], ids[1], `answer ${turn}`, 2));
      parent = ids[2];
    }
    const file = writeSession(join(root, 'large.jsonl'), lines);
    let longest = 0;
    let last = performance.now();
    const ticker = setInterval(() => {
      const now = performance.now();
      longest = Math.max(longest, now - last);
      last = now;
    }, 1);
    const read = await readSessionFile(file);
    // The last stretch has no tick after it.
    longest = Math.max(longest, performance.now() - last);
    clearInterval(ticker);
    expect(read.size).toBeGreaterThan(20_000_000);
    expect(read.entries).toHaveLength(3000);
    // One chunk's lines at a time; a generous bound for a busy machine.
    expect(longest).toBeLessThan(150);
  });

  it('refuses a file over its byte limit before parsing it into a view', async () => {
    const file = writeSession(join(root, 'limited.jsonl'), [
      header('limited', '/p'),
      system('system', null, 4096),
      user('u1', 'system', 'hello', 1),
    ]);
    await expect(readSessionFile(file, { bytes: 1024 })).rejects.toBeInstanceOf(SessionTooLargeError);
    await expect(new SessionReader({ bytes: 1024 }).view(file)).rejects.toThrow(/file is too large/);
  });

  it('refuses a file with too many entries', async () => {
    const file = writeSession(join(root, 'entries.jsonl'), [
      header('entries', '/p'),
      user('u1', null, 'one', 1),
      user('u2', 'u1', 'two', 2),
      user('u3', 'u2', 'three', 3),
    ]);
    await expect(readSessionFile(file, { entries: 2 })).rejects.toThrow(/too many entries/);
  });

  it('refuses one entry too large to become a useful view', async () => {
    const file = writeSession(join(root, 'giant-entry.jsonl'), [
      header('giant', '/p'),
      user('u1', null, 'x'.repeat(2 * 1024 * 1024), 1),
    ]);
    await expect(new SessionReader({ bytes: 4 * 1024 * 1024, entryBytes: 1024 }).view(file)).rejects.toThrow(
      /entry is too large/
    );
  });
});

describe('SessionReader', () => {
  it('keeps the view of a file while its size and time stay, and reads it again once it changed', async () => {
    const file = writeSession(join(root, 'kept.jsonl'), [header('s1', '/p'), user('u1', null, 'hello', 1)]);
    const reader = new SessionReader();
    const first = await reader.view(file);
    expect(first).toMatchObject({ header: { id: 's1' }, lastEntryId: 'u1' });
    expect(first.view.messages).toHaveLength(1);
    await expect(reader.view(file)).resolves.toBe(first);
    appendFileSync(file, `${JSON.stringify(assistant('a1', 'u1', 'hi', 2))}\n`);
    const second = await reader.view(file);
    expect(second).not.toBe(first);
    expect(second.lastEntryId).toBe('a1');
    expect(second.view.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    reader.forget(file);
    await expect(reader.view(file)).resolves.not.toBe(second);
  });

  it('fails for a file that is not there', async () => {
    writeFileSync(join(root, 'present.jsonl'), '');
    await expect(new SessionReader().view(join(root, 'absent.jsonl'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(new SessionReader().view(join(root, 'present.jsonl'))).resolves.toMatchObject({
      view: { messages: [] },
    });
  });
});
