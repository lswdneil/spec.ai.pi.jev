import { open, stat } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';
import { fromEntries } from '../../../../common/utils/nativeHost/reducer.ts';
import type { JsonObject } from '../../../../common/utils/nativeHost/records.ts';
import { sessionSettings, type SessionSettings } from '../../../../common/utils/nativeHost/settings.ts';
import type { NativeView } from '../../../../common/utils/nativeHost/view.ts';
import { parseEntry, readHeader, type SessionHeader } from './summary.ts';

/**
 * A session file read back without a host: its entries, in order, and the view pi's branch gives (fromEntries), for a
 * conversation opened with no host running. The file is read in chunks of CHUNK_BYTES, each a separate read, so the
 * main process answers other calls between them even for a large file. A line that does not parse (a corrupt one, or
 * a last line pi was still writing) is left out, as pi leaves it out when it opens the file.
 */

const CHUNK_BYTES = 1024 * 1024;
/** The largest file read whole. A view built from it must still fit the IPC limit (nativeBridge.ts). */
export const MAX_SESSION_BYTES = 32 * 1024 * 1024;
/** Large files stop being useful in the conversation view, and make every subsequent reducer step copy more data. */
export const MAX_SESSION_ENTRIES = 20_000;
/** One tool result can be large, but a single line this size is not a useful view. */
export const MAX_SESSION_ENTRY_BYTES = 16 * 1024 * 1024;

export type SessionReadLimits = {
  bytes: number;
  entries: number;
  entryBytes: number;
};

const DEFAULT_LIMITS: SessionReadLimits = {
  bytes: MAX_SESSION_BYTES,
  entries: MAX_SESSION_ENTRIES,
  entryBytes: MAX_SESSION_ENTRY_BYTES,
};

export class SessionTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionTooLargeError';
  }
}

const tooLarge = (what: string, size: number, limit: number): SessionTooLargeError => {
  const megabytes = (size / 1024 / 1024).toFixed(1);
  const limitMegabytes = (limit / 1024 / 1024).toFixed(1);
  return new SessionTooLargeError(
    `The session ${what} is too large to open safely (${megabytes} MB; limit ${limitMegabytes} MB)`
  );
};

export type SessionRead = {
  header?: SessionHeader;
  /** Every entry of the file but its header, in file order. */
  entries: JsonObject[];
  /** The file's last entry: where pi's branch ends when it opens the file. */
  lastEntryId?: string;
  /** The file as it was read. */
  size: number;
  mtimeMs: number;
};

export async function readSessionFile(file: string, options: Partial<SessionReadLimits> = {}): Promise<SessionRead> {
  const limits = { ...DEFAULT_LIMITS, ...options };
  const handle = await open(file, 'r');
  try {
    const stats = await handle.stat();
    if (stats.size > limits.bytes) throw tooLarge('file', stats.size, limits.bytes);
    const decoder = new StringDecoder('utf8');
    const chunk = Buffer.alloc(CHUNK_BYTES);
    const entries: JsonObject[] = [];
    let header: SessionHeader | undefined;
    let first = true;
    const take = (line: string): void => {
      const entry = parseEntry(line);
      if (first && entry) {
        first = false;
        header = readHeader(entry);
        if (header) return;
      }
      if (entry && entry.type !== 'session') {
        if (entries.length >= limits.entries)
          throw new SessionTooLargeError(
            `The session has too many entries to open safely (limit ${limits.entries.toLocaleString('en-US')})`
          );
        entries.push(entry);
      }
    };
    // The start of a line that the chunks read so far have not ended.
    let partial = '';
    let partialBytes = 0;
    let position = 0;
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- one chunk at a time, so other work runs between them
      const { bytesRead } = await handle.read(chunk, 0, CHUNK_BYTES, position);
      if (bytesRead === 0) break;
      position += bytesRead;
      if (position > limits.bytes) throw tooLarge('file', position, limits.bytes);
      const text = decoder.write(chunk.subarray(0, bytesRead));
      let start = 0;
      for (let newline = text.indexOf('\n'); newline >= 0; newline = text.indexOf('\n', start)) {
        const piece = text.slice(start, newline);
        const lineBytes = partialBytes + Buffer.byteLength(piece);
        if (lineBytes > limits.entryBytes) throw tooLarge('entry', lineBytes, limits.entryBytes);
        take(`${partial}${piece}`);
        partial = '';
        partialBytes = 0;
        start = newline + 1;
      }
      if (start < text.length) {
        const rest = text.slice(start);
        partial += rest;
        partialBytes += Buffer.byteLength(rest);
        if (partialBytes > limits.entryBytes) throw tooLarge('entry', partialBytes, limits.entryBytes);
      }
    }
    const tail = decoder.end();
    partial += tail;
    partialBytes += Buffer.byteLength(tail);
    if (partialBytes > limits.entryBytes) throw tooLarge('entry', partialBytes, limits.entryBytes);
    take(partial);
    const last = entries.findLast((entry) => typeof entry.id === 'string');
    return {
      ...(header ? { header } : {}),
      entries,
      ...(last ? { lastEntryId: last.id as string } : {}),
      size: position,
      mtimeMs: stats.mtimeMs,
    };
  } finally {
    await handle.close();
  }
}

/** A session file's view as pi would open it (the branch that ends at its last entry), and what it was read from. */
export type SessionViewRead = {
  header?: SessionHeader;
  view: NativeView;
  /** The model, thinking level and permission mode the branch says its session runs with. */
  settings: SessionSettings;
  lastEntryId?: string;
  size: number;
  mtimeMs: number;
};

/** How many views of recently read files are kept, for an open followed by a host start on the same file. */
const KEPT_VIEWS = 2;

/** Reads session files into views, keeping the last few by the file's size and time. */
export class SessionReader {
  private readonly kept = new Map<string, SessionViewRead>();
  private readonly limits: Partial<SessionReadLimits>;

  constructor(limits: Partial<SessionReadLimits> = {}) {
    this.limits = limits;
  }

  async view(file: string): Promise<SessionViewRead> {
    const stats = await stat(file);
    const limit = this.limits.bytes ?? MAX_SESSION_BYTES;
    if (stats.size > limit) throw tooLarge('file', stats.size, limit);
    const kept = this.kept.get(file);
    if (kept && kept.size === stats.size && kept.mtimeMs === stats.mtimeMs) {
      this.kept.delete(file);
      this.kept.set(file, kept);
      return kept;
    }
    const read = await readSessionFile(file, this.limits);
    const result: SessionViewRead = {
      ...(read.header ? { header: read.header } : {}),
      view: fromEntries(read.entries),
      settings: sessionSettings(read.entries),
      ...(read.lastEntryId ? { lastEntryId: read.lastEntryId } : {}),
      size: read.size,
      mtimeMs: read.mtimeMs,
    };
    this.kept.delete(file);
    this.kept.set(file, result);
    const oldest = this.kept.keys().next().value;
    if (this.kept.size > KEPT_VIEWS && oldest !== undefined) this.kept.delete(oldest);
    return result;
  }

  /** Forgets what was kept of a file (it was removed, or a host changed it). */
  forget(file: string): void {
    this.kept.delete(file);
  }
}
