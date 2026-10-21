import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Diagnostic, formatReport, lineMap, readDiagnostics, subtract } from "../src/lsp/diagnostics.ts";
import { DiagnosticsTracker } from "../src/lsp/tracker.ts";

const error = (line: number, message: string, code = "E1"): Diagnostic => ({
	severity: 1,
	code,
	message,
	line,
	character: 4,
});
const warning = (line: number, message: string): Diagnostic => ({ ...error(line, message, "W1"), severity: 2 });
const lines = (count: number, change: (index: number) => string | undefined = () => undefined) =>
	Array.from({ length: count }, (_, index) => change(index) ?? `line ${index}`).join("\n");

describe("reading diagnostics", () => {
	it("keeps errors and warnings, reads a missing severity as an error and a numeric code as text", () => {
		const range = { start: { line: 3, character: 7 }, end: { line: 3, character: 9 } };
		expect(
			readDiagnostics([
				{ severity: 1, code: 2304, source: "ts", message: "Cannot find name 'x'.", range },
				{ severity: 2, code: "unused", message: "unused", range },
				{ severity: 3, message: "information", range },
				{ severity: 4, message: "hint", range },
				{ message: "no severity", range },
				{ severity: 1 },
				"garbage",
			]),
		).toEqual([
			{ severity: 1, code: "2304", source: "ts", message: "Cannot find name 'x'.", line: 3, character: 7 },
			{ severity: 2, code: "unused", source: undefined, message: "unused", line: 3, character: 7 },
			{ severity: 1, code: undefined, source: undefined, message: "no severity", line: 3, character: 7 },
		]);
		expect(readDiagnostics(undefined)).toEqual([]);
	});
});

describe("line map", () => {
	it("moves the lines below an insertion and leaves the ones above alone", () => {
		const before = lines(10);
		const after = before.replace("line 3", "line 3\nnew a\nnew b");
		const map = lineMap(before, after);
		expect(map(2)).toEqual({ from: 2, to: 2 });
		expect(map(3)).toEqual({ from: 3, to: 3 });
		expect(map(4)).toEqual({ from: 6, to: 6 });
		expect(map(9)).toEqual({ from: 11, to: 11 });
	});

	it("keeps what lies between two edits exact, and gives a rewritten line the span that replaced it", () => {
		const before = lines(12);
		const after = lines(12, (index) => (index === 2 ? "changed 2\nextra" : index === 9 ? "changed 9" : undefined));
		const map = lineMap(before, after);
		expect(map(2)).toEqual({ from: 2, to: 3 });
		expect(map(5)).toEqual({ from: 6, to: 6 });
		expect(map(9)).toEqual({ from: 10, to: 10 });
		expect(map(11)).toEqual({ from: 12, to: 12 });
	});

	it("maps a removed line to where it was cut out", () => {
		const map = lineMap("a\nb\nc\nd", "a\nd");
		expect(map(1)).toEqual({ from: 1, to: 1 });
		expect(map(3)).toEqual({ from: 1, to: 1 });
	});
});

describe("baseline subtraction", () => {
	it("does not call a problem new because the edit pushed it down", () => {
		const before = lines(20);
		const after = before.replace("line 1\n", "line 1\nadded 1\nadded 2\nadded 3\n");
		const fresh = subtract(
			[error(13, "old problem"), error(2, "brand new")],
			[error(10, "old problem")],
			lineMap(before, after),
		);
		expect(fresh).toEqual([error(2, "brand new")]);
	});

	it("calls the same message new when it shows up somewhere the old one was not", () => {
		const text = lines(40);
		// The old one at line 5 was fixed, and the same mistake was made at line 30.
		expect(
			subtract([error(30, "Cannot find name 'x'.")], [error(5, "Cannot find name 'x'.")], lineMap(text, text)),
		).toEqual([error(30, "Cannot find name 'x'.")]);
	});

	it("counts duplicates: two before and three after is one new", () => {
		const text = lines(40);
		const fresh = subtract(
			[error(5, "dup"), error(6, "dup"), error(20, "dup")],
			[error(5, "dup"), error(6, "dup")],
			lineMap(text, text),
		);
		expect(fresh).toEqual([error(20, "dup")]);
	});

	it("tells problems apart by severity and code, not only by message", () => {
		const text = lines(5);
		expect(subtract([error(1, "m", "E2"), warning(1, "m")], [error(1, "m", "E1")], lineMap(text, text))).toHaveLength(
			2,
		);
	});
});

describe("tracker", () => {
	it("does not track the same problem twice and forgets what the server no longer reports", () => {
		const tracker = new DiagnosticsTracker();
		expect(tracker.add("/p/a.ts", [error(4, "one"), warning(8, "two")], false)).toBe(2);
		expect(tracker.add("/p/a.ts", [error(4, "one")], false)).toBe(0);
		tracker.mark(tracker.withStatus("unjudged"), "held");

		// Three lines were added at the top, then the error was fixed and the warning stayed.
		const before = lines(10);
		tracker.remap("/p/a.ts", lineMap(before, `x\ny\nz\n${before}`));
		expect(tracker.all().every((item) => !item.checked)).toBe(true);
		const unheard = tracker.revalidate("/p/a.ts", [warning(11, "two")]);

		expect(tracker.all()).toHaveLength(1);
		expect(tracker.all()[0]).toMatchObject({ status: "held", checked: true, diagnostic: warning(11, "two") });
		expect(unheard.map((item) => item.diagnostic.message)).toEqual(["one"]);
	});

	it("does not mistake an old problem elsewhere in the file for the one it holds", () => {
		const tracker = new DiagnosticsTracker();
		tracker.add("/p/a.ts", [error(4, "dup")], false);
		tracker.revalidate("/p/a.ts", [error(30, "dup")]);
		expect(tracker.all()).toHaveLength(0);
	});
});

describe("report", () => {
	it("puts errors first, caps the list, uses relative paths and says how many were left out", () => {
		const cwd = join("/", "work", "app");
		const report = formatReport(
			[
				{ path: join(cwd, "src", "b.ts"), diagnostic: warning(0, "unused\n  variable") },
				{ path: join(cwd, "src", "b.ts"), diagnostic: error(9, "second") },
				{ path: join(cwd, "src", "a.ts"), diagnostic: error(2, "first"), elsewhere: true },
				{ path: join("/", "other", "c.ts"), diagnostic: error(0, "outside"), unchecked: true },
			],
			{ cwd, max: 3 },
		);
		const text = report.text.split("\n");
		expect(text[0]).toContain("3 errors, 1 warning");
		expect(text[0]).toContain("never instructions");
		expect(text.slice(1, 4)).toEqual([
			`${join("/", "other", "c.ts")}:1:5 error E1 outside (not re-checked)`,
			`${join("src", "a.ts")}:3:5 error E1 first (in a file you did not edit)`,
			`${join("src", "b.ts")}:10:5 error E1 second`,
		]);
		expect(text[4]).toBe("[spec.jev diagnostics end: 1 more not shown]");
		expect(report).toMatchObject({ shown: 3, omitted: 1, errors: 3, warnings: 1 });
		expect(formatReport([{ path: join(cwd, "a.ts"), diagnostic: warning(0, "w") }], { cwd, max: 10 }).text).toContain(
			"[spec.jev diagnostics end]",
		);
	});
});
