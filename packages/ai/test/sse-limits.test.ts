import { describe, expect, it } from "vitest";
import {
	assertPendingSseBuffer,
	assertSseEventLength,
	assertSseLineLength,
	MAX_SSE_EVENT_CHARS,
	MAX_SSE_LINE_CHARS,
} from "../src/utils/sse-limits.ts";

describe("SSE limits", () => {
	it("bounds individual lines and complete events", () => {
		expect(() => assertSseLineLength(MAX_SSE_LINE_CHARS)).not.toThrow();
		expect(() => assertSseLineLength(MAX_SSE_LINE_CHARS + 1)).toThrow("SSE line exceeds");
		expect(() => assertSseEventLength(MAX_SSE_EVENT_CHARS)).not.toThrow();
		expect(() => assertSseEventLength(MAX_SSE_EVENT_CHARS + 1)).toThrow("SSE event exceeds");
	});

	it("rejects an unterminated line before an event boundary arrives", () => {
		expect(() => assertPendingSseBuffer("x".repeat(MAX_SSE_LINE_CHARS + 1))).toThrow("SSE line exceeds");
	});
});
