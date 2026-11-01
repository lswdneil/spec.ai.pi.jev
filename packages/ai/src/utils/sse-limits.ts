/** Bounds one SSE line before provider-specific parsing can allocate unbounded strings. */
export const MAX_SSE_LINE_CHARS = 1_000_000;

/** Bounds one complete SSE event, including all of its `data:` lines. */
export const MAX_SSE_EVENT_CHARS = 4_000_000;

export class SseLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SseLimitError";
	}
}

export function assertSseLineLength(length: number): void {
	if (length > MAX_SSE_LINE_CHARS) {
		throw new SseLimitError(`SSE line exceeds ${MAX_SSE_LINE_CHARS} characters`);
	}
}

export function assertSseEventLength(length: number): void {
	if (length > MAX_SSE_EVENT_CHARS) {
		throw new SseLimitError(`SSE event exceeds ${MAX_SSE_EVENT_CHARS} characters`);
	}
}

/** Checks a not-yet-delimited tail: one line must stay bounded while an event accumulates. */
export function assertPendingSseBuffer(buffer: string): void {
	assertSseEventLength(buffer.length);
	const lastBreak = Math.max(buffer.lastIndexOf("\n"), buffer.lastIndexOf("\r"));
	assertSseLineLength(buffer.length - lastBreak - 1);
}
