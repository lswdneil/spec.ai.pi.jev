/**
 * Building only some members of a large JSON object.
 *
 * Claude Code keeps every project it has seen in `~/.claude.json`, with that project's prompt history, and the file
 * grows to tens of MB. spec.jev needs two of its members. `JSON.parse` of the whole file costs several times its size in
 * heap, and it ran twice at every start: a 30 MB file took the heap from about 40 MB to about 180 MB. Here the bytes
 * are only scanned, and a member is parsed when it is asked for.
 */

/** Which members to build: all of one (`true`), or of an object member only the entries whose key passes. */
export type JsonSelection = Readonly<Record<string, true | ((key: string) => boolean)>>;

/** A member of an object: its key, and where its value is in the bytes. */
interface Member {
	readonly key: string;
	readonly start: number;
	readonly end: number;
}

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const COMMA = 0x2c;
const COLON = 0x3a;
const OPEN_OBJECT = 0x7b;
const CLOSE_OBJECT = 0x7d;
const OPEN_ARRAY = 0x5b;
const CLOSE_ARRAY = 0x5d;

function isSpace(byte: number | undefined): boolean {
	return byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;
}

function skipSpace(bytes: Buffer, at: number): number {
	let index = at;
	while (isSpace(bytes[index])) index++;
	return index;
}

/** Just past the closing quote of the string that starts at `at`. */
function stringEnd(bytes: Buffer, at: number): number {
	let from = at + 1;
	for (;;) {
		const quote = bytes.indexOf(QUOTE, from);
		if (quote === -1) throw new SyntaxError("a string is not closed");
		// A quote is escaped when an odd number of backslashes runs up to it. The opening quote ends the count.
		let backslashes = 0;
		while (bytes[quote - 1 - backslashes] === BACKSLASH) backslashes++;
		if (backslashes % 2 === 0) return quote + 1;
		from = quote + 1;
	}
}

/** Just past the value that starts at `at`, without building it. */
function valueEnd(bytes: Buffer, at: number): number {
	const first = bytes[at];
	if (first === QUOTE) return stringEnd(bytes, at);
	if (first === OPEN_OBJECT || first === OPEN_ARRAY) {
		let depth = 0;
		for (let index = at; index < bytes.length; index++) {
			const byte = bytes[index];
			if (byte === QUOTE) index = stringEnd(bytes, index) - 1;
			else if (byte === OPEN_OBJECT || byte === OPEN_ARRAY) depth++;
			else if (byte === CLOSE_OBJECT || byte === CLOSE_ARRAY) {
				depth--;
				if (depth === 0) return index + 1;
			}
		}
		throw new SyntaxError("an object or an array is not closed");
	}
	// A number, true, false or null runs to the next delimiter. JSON.parse checks it if it is ever built.
	let index = at;
	for (; index < bytes.length; index++) {
		const byte = bytes[index];
		if (isSpace(byte) || byte === COMMA || byte === CLOSE_OBJECT || byte === CLOSE_ARRAY) break;
	}
	if (index === at) throw new SyntaxError("a value is missing");
	return index;
}

/** The members of the object whose opening brace is at `at`, in order, and the index just past its closing brace. */
function scanObject(bytes: Buffer, at: number): { members: Member[]; end: number } {
	const members: Member[] = [];
	let index = skipSpace(bytes, at + 1);
	if (bytes[index] === CLOSE_OBJECT) return { members, end: index + 1 };
	for (;;) {
		if (bytes[index] !== QUOTE) throw new SyntaxError("a key is missing");
		const keyEnd = stringEnd(bytes, index);
		const key: unknown = JSON.parse(bytes.toString("utf8", index, keyEnd));
		index = skipSpace(bytes, keyEnd);
		if (bytes[index] !== COLON) throw new SyntaxError("a colon is missing");
		const start = skipSpace(bytes, index + 1);
		const end = valueEnd(bytes, start);
		members.push({ key: String(key), start, end });
		index = skipSpace(bytes, end);
		if (bytes[index] === CLOSE_OBJECT) return { members, end: index + 1 };
		if (bytes[index] !== COMMA) throw new SyntaxError("a comma or a closing brace is missing");
		index = skipSpace(bytes, index + 1);
	}
}

function parseMember(bytes: Buffer, member: Member): unknown {
	return JSON.parse(bytes.toString("utf8", member.start, member.end));
}

/**
 * The selected members of the JSON object in `bytes`, parsed. Everything else is scanned, not built, and a member
 * selected by a key test that is not an object is left out. As with `JSON.parse`, the last of two equal keys wins.
 * `undefined` when the text holds something other than an object; a SyntaxError when the object is not JSON.
 */
export function parseSelected(bytes: Buffer, selection: JsonSelection): Record<string, unknown> | undefined {
	// A byte order mark is not JSON, but editors write one.
	const at = skipSpace(bytes, bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0);
	if (bytes[at] !== OPEN_OBJECT) return undefined;
	const top = scanObject(bytes, at);
	if (skipSpace(bytes, top.end) !== bytes.length) throw new SyntaxError("something follows the object");
	const picked = new Map<string, unknown>();
	for (const member of top.members) {
		const want = Object.hasOwn(selection, member.key) ? selection[member.key] : undefined;
		if (want === undefined) continue;
		if (want === true) {
			picked.set(member.key, parseMember(bytes, member));
			continue;
		}
		if (bytes[member.start] !== OPEN_OBJECT) {
			picked.delete(member.key);
			continue;
		}
		const entries = new Map<string, unknown>();
		for (const entry of scanObject(bytes, member.start).members) {
			if (want(entry.key)) entries.set(entry.key, parseMember(bytes, entry));
		}
		picked.set(member.key, Object.fromEntries(entries));
	}
	return Object.fromEntries(picked);
}
