import { open, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { KyrnError } from '../../../common/kyrn/errors';
import {
  FOLDER_HIDDEN,
  FOLDER_LISTING_LIMIT,
  type FolderEntry,
  type FolderListing,
} from '../../../common/kyrn/folderBridge';

/*
 * The files tab of a native conversation (common/kyrn/folderBridge.ts): one directory of the conversation's folder at
 * a time, read afresh for every answer, so what the model wrote shows at the next look. Nothing is written here.
 */

const LONGEST_PATH = 4096;

/** A folder as the screen sends it: a full path, one line, not too long. */
export function readFolder(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > LONGEST_PATH ||
    value.includes('\u0000') ||
    /[\r\n]/.test(value) ||
    !isAbsolute(value)
  )
    throw new KyrnError('invalid', 'Invalid folder');
  return value;
}

const STORED_SESSION = /^[a-f\d-]{36}\.json$/i;

/** Enough for a session header line, which names the folder the conversation ran in. */
const HEADER_BYTES = 4096;

/** The folder named by a spec.jev session file's first line, when that line is a session header. */
async function sessionHeaderCwd(file: string): Promise<string | undefined> {
  try {
    const handle = await open(file, 'r');
    try {
      const buffer = Buffer.alloc(HEADER_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0);
      const header = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8').split('\n', 1)[0]) as {
        type?: unknown;
        cwd?: unknown;
      };
      return header.type === 'session' && typeof header.cwd === 'string' ? header.cwd : undefined;
    } finally {
      await handle.close();
    }
  } catch {
    return undefined;
  }
}

/**
 * A folder the app can show is one recorded by a native session. The folder is
 * canonicalized before it becomes the root for every later path check. An ACP
 * record is written before a conversation's first turn can still be dropped,
 * and a folder picked after it is not in that record; spec.jev's own session
 * headers name the folder each conversation runs in, so they are read too.
 */
export async function authorizeFolder(store: string, value: unknown, agentDir?: string): Promise<string> {
  const requested = readFolder(value);
  let root: string;
  try {
    root = await realpath(requested);
  } catch {
    throw new KyrnError('invalid', 'Folder is not readable');
  }

  let sessions: string[];
  try {
    sessions = (await readdir(store, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && STORED_SESSION.test(entry.name))
      .map((entry) => join(store, entry.name));
  } catch {
    throw new KyrnError('invalid', 'Folder is not attached to a session');
  }

  for (const session of sessions) {
    try {
      const record = JSON.parse(await readFile(session, 'utf8')) as { cwd?: unknown };
      if (typeof record.cwd !== 'string') continue;
      if ((await realpath(record.cwd)) === root) return root;
    } catch {
      // A half-written or moved session does not authorize a folder.
    }
  }
  if (agentDir) {
    const sessionsDir = join(agentDir, 'sessions');
    const dirs = (await readdir(sessionsDir, { withFileTypes: true }).catch(() => [])).filter((entry) =>
      entry.isDirectory()
    );
    const files = (
      await Promise.all(
        dirs.map((entry) =>
          readdir(join(sessionsDir, entry.name))
            .then((names) =>
              names.filter((name) => name.endsWith('.jsonl')).map((name) => join(sessionsDir, entry.name, name))
            )
            .catch(() => [])
        )
      )
    ).flat();
    const folders = (await Promise.all(files.map((file) => sessionHeaderCwd(file)))).filter(
      (cwd): cwd is string => typeof cwd === 'string'
    );
    const resolved = await Promise.all(folders.map((cwd) => realpath(cwd).catch(() => undefined)));
    if (resolved.includes(root)) return root;
  }
  throw new KyrnError('invalid', 'Folder is not attached to a session');
}

function isInside(root: string, candidate: string): boolean {
  const within = relative(root, candidate);
  return within === '' || (!within.startsWith(`..${sep}`) && within !== '..' && !isAbsolute(within));
}

/** A path inside the folder: relative, `/` between names, never above the folder. '' is the folder itself. */
function inside(folder: string, path: unknown): { absolute: string; relative: string } {
  if (typeof path !== 'string' || path.length > LONGEST_PATH || path.includes('\u0000') || /[\r\n]/.test(path))
    throw new KyrnError('invalid', 'Invalid path');
  const absolute = resolve(folder, ...path.split('/').filter(Boolean));
  const within = relative(folder, absolute);
  if (!isInside(folder, absolute)) throw new KyrnError('invalid', 'The path leaves the folder');
  return { absolute, relative: within.split(sep).join('/') };
}

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * One directory of `folder`: its entries (folders first, each group by name), at most FOLDER_LISTING_LIMIT, the rest
 * counted. A link counts as what it points to; a broken one as a file. A directory that cannot be read names itself.
 */
export async function listFolder(folder: string, path: unknown): Promise<FolderListing> {
  let root: string;
  try {
    root = await realpath(folder);
  } catch (error) {
    throw new KyrnError('unreadable', error instanceof Error ? error.message : String(error), { file: folder });
  }
  const where = inside(root, path);
  let actual: string;
  try {
    actual = await realpath(where.absolute);
  } catch (error) {
    throw new KyrnError('unreadable', error instanceof Error ? error.message : String(error), {
      file: where.absolute,
    });
  }
  if (!isInside(root, actual)) throw new KyrnError('invalid', 'The path leaves the folder');

  let names: Array<{ name: string; dir: boolean; link: boolean }>;
  try {
    const entries = await readdir(actual, { withFileTypes: true });
    names = entries
      .filter((entry) => !FOLDER_HIDDEN.has(entry.name))
      .map((entry) => ({ name: entry.name, dir: entry.isDirectory(), link: entry.isSymbolicLink() }));
  } catch (error) {
    throw new KyrnError('unreadable', error instanceof Error ? error.message : String(error), {
      file: where.absolute,
    });
  }
  // A link counts as what it points to.
  await Promise.all(
    names
      .filter((entry) => entry.link)
      .map(async (entry) => {
        entry.dir = await stat(join(actual, entry.name)).then(
          (info) => info.isDirectory(),
          () => false
        );
      })
  );
  const sorted = names.toSorted((a, b) => Number(b.dir) - Number(a.dir) || byName.compare(a.name, b.name));
  const entries: FolderEntry[] = sorted.slice(0, FOLDER_LISTING_LIMIT).map((entry) => ({
    name: entry.name,
    path: where.relative ? `${where.relative}/${entry.name}` : entry.name,
    kind: entry.dir ? 'dir' : 'file',
  }));
  return { path: where.relative, entries, more: sorted.length - entries.length };
}
