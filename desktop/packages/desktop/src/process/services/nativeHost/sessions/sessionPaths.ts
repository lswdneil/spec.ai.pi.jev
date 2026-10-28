import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { SessionFolders } from './folders.ts';
import { parseEntry, readHeader, type SessionHeader } from './summary.ts';

/** Enough of a session's first line for its header; a long line is not a session header. */
const HEADER_BYTES = 64 * 1024;

export type ValidatedSessionFile = {
  /** The canonical file path pi should open. */
  file: string;
  header: SessionHeader;
};

export class InvalidSessionFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSessionFileError';
  }
}

const inside = (root: string, file: string): boolean => {
  const relative = path.relative(root, file);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

async function readSessionHeader(file: string): Promise<SessionHeader | undefined> {
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(HEADER_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const newline = buffer.subarray(0, bytesRead).indexOf(0x0a);
    if (newline < 0 || newline > HEADER_BYTES) return undefined;
    return readHeader(parseEntry(buffer.toString('utf8', 0, newline).replace(/\r$/, '')));
  } finally {
    await handle.close();
  }
}

/**
 * The canonical path of a session file under one of spec.jev's session roots, after checking that it is a regular file
 * (not a directory or a link) and that its first line is a session header. A relative path is resolved against `cwd`,
 * as pi resolves a `switch_session` path.
 */
export async function validateSessionFile(
  folders: SessionFolders,
  requested: string,
  cwd: string
): Promise<ValidatedSessionFile> {
  if (!requested) throw new InvalidSessionFileError('A session path is required');
  const candidate = path.isAbsolute(requested) ? path.normalize(requested) : path.resolve(cwd, requested);
  if (path.extname(candidate) !== '.jsonl') throw new InvalidSessionFileError(`Not a session file: ${candidate}`);

  const stats = await lstat(candidate);
  if (stats.isSymbolicLink()) throw new InvalidSessionFileError(`Session files may not be links: ${candidate}`);
  if (!stats.isFile()) throw new InvalidSessionFileError(`Not a regular session file: ${candidate}`);

  const file = await realpath(candidate);
  const found = await Promise.all(
    [folders.sessionsDir, folders.customDir]
      .filter((root): root is string => Boolean(root))
      .map((root) => realpath(root).catch((): undefined => undefined))
  );
  const roots = found.filter((root, index): root is string => root !== undefined && found.indexOf(root) === index);
  if (!roots.some((root) => inside(root, file)))
    throw new InvalidSessionFileError(`The session is outside spec.jev's session folders: ${candidate}`);

  const header = await readSessionHeader(file);
  if (!header) throw new InvalidSessionFileError(`Not a valid session file: ${candidate}`);
  return { file, header };
}
