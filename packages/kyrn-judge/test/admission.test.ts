import { existsSync, readFileSync } from "node:fs";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHarness, type Harness } from "../../coding-agent/test/suite/harness.ts";
import { parseConfig } from "../src/config.ts";
import { chunkLines, describeCall } from "../src/extension/features/admission.ts";
import { createKyrnJudgeExtension } from "../src/extension/kyrn-judge.ts";
import { MockJudgeProvider } from "../src/providers/mock.ts";
import type { Answer } from "../src/types.ts";

const noise = Array.from(
	{ length: 120 },
	(_, index) => `npm warn deprecated left-pad@1.${index}.0: use String.prototype.padStart`,
);
const failure = ["FAIL test/login.test.ts", "  expected session cookie to be set", "  at login.test.ts:42:7"];
const output = [
	"> npm test",
	...noise.slice(0, 60),
	...failure,
	...noise.slice(60),
	"Tests: 1 failed, 211 passed",
].join("\n");

const runTests: AgentTool = {
	name: "run_tests",
	label: "Run tests",
	description: "Run the test suite",
	parameters: Type.Object({ command: Type.String() }),
	execute: async () => ({ content: [{ type: "text", text: output }], details: {} }),
};

/** Calls a chunk a repeated warning unless it shows the failing test: one chunk per request (`chunk`), or many (`c1`… asked by `k1`…). */
function kindJudge(): MockJudgeProvider {
	return new MockJudgeProvider((request): Record<string, Answer> => {
		const state = request.state as Record<string, unknown>;
		const answers: Record<string, Answer> = {};
		for (const id of Object.keys(request.questions)) {
			const chunk = id === "kind" ? state.chunk : state[`c${id.slice(1)}`];
			if (typeof chunk !== "string") continue;
			const choice = chunk.includes("FAIL") ? "error" : "warning";
			answers[id] = { type: "choice", choice, probabilities: { [choice]: 0.95 } };
		}
		return answers;
	});
}

/** The requests that classified chunks. */
const admissionCalls = (provider: MockJudgeProvider) =>
	provider.calls.filter((call) => Object.keys(call.questions).some((id) => id === "kind" || /^k\d+$/.test(id)));

/** The chunks between the first and the last, which are the ones put to the judge. */
const middleChunks = chunkLines(output, 1200).length - 2;

function toolResultText(harness: Harness): string {
	const result = harness.session.messages.find((message) => message.role === "toolResult");
	const content = (result as { content?: { type: string; text?: string }[] } | undefined)?.content ?? [];
	return content.map((block) => block.text ?? "").join("\n");
}

describe("tool output admission", () => {
	const harnesses: Harness[] = [];
	afterEach(() => {
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
	});

	async function run(
		mode: "shadow" | "active",
		provider = kindJudge(),
		config: Record<string, unknown> = {},
	): Promise<Harness> {
		// About what a result keeps, not about who allows the command that made it.
		vi.stubEnv("SPECJEV_PERMISSIONS", "full");
		const harness = await createHarness({
			tools: [runTests],
			extensionFactories: [
				createKyrnJudgeExtension({
					provider,
					mode,
					...(Object.keys(config).length ? { config: parseConfig(config) } : {}),
				}),
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage(
				[
					fauxText("Running the suite to find the failing test."),
					fauxToolCall("run_tests", { command: "npm test" }),
				],
				{
					stopReason: "toolUse",
				},
			),
			fauxAssistantMessage("The login test fails."),
		]);
		await harness.session.prompt("Why is CI red?");
		return harness;
	}

	it("keeps the failing test, the first and the last chunk, and archives what it drops", async () => {
		const provider = kindJudge();
		const harness = await run("active", provider);
		const text = toolResultText(harness);

		expect(text).toContain("FAIL test/login.test.ts");
		expect(text.startsWith("> npm test")).toBe(true);
		expect(text).toContain("Tests: 1 failed, 211 passed");
		expect(text.length).toBeLessThan(output.length / 2);

		const pointer = /full output: (\S+)\]/.exec(text);
		expect(pointer).not.toBeNull();
		const archive = pointer?.[1] ?? "";
		expect(existsSync(archive)).toBe(true);
		expect(readFileSync(archive, "utf8")).toBe(output);

		expect(text).toContain("of warning output omitted");

		// A hosted judge saw every middle chunk in one request, with the call that produced them, not the conversation.
		const calls = admissionCalls(provider);
		expect(calls).toHaveLength(1);
		expect(middleChunks).toBeGreaterThan(1);
		expect(Object.keys(calls[0].state as object)).toEqual([
			"call",
			...Array.from({ length: middleChunks }, (_, index) => `c${index + 1}`),
		]);
		expect(Object.keys(calls[0].questions)).toEqual(
			Array.from({ length: middleChunks }, (_, index) => `k${index + 1}`),
		);
		expect(calls[0].state).toMatchObject({ call: "run_tests: npm test" });
	});

	it("asks a local judge one chunk at a time, with the same result", async () => {
		const provider = kindJudge();
		const harness = await run("active", provider, { tiers: ["laya"] });
		const text = toolResultText(harness);
		expect(text).toContain("FAIL test/login.test.ts");
		expect(text).toContain("of warning output omitted");
		const calls = admissionCalls(provider);
		expect(calls).toHaveLength(middleChunks);
		for (const call of calls) expect(Object.keys(call.state as object)).toEqual(["call", "chunk"]);
	});

	it("past the wait, lets the output through whole and only records the verdict", async () => {
		let release: () => void = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const slow = new MockJudgeProvider(async (request) => {
			// Only the chunk verdicts are slow; the questions before the turn answer at once.
			if (!Object.keys(request.questions).some((id) => id === "kind" || /^k\d+$/.test(id))) return {};
			await held;
			return kindJudge()
				.evaluate(request)
				.then((response) => response.answers);
		});
		const startedAt = Date.now();
		const harness = await run("active", slow, { features: { admission: { waitMs: 60 } } });
		expect(toolResultText(harness)).toBe(output);
		expect(Date.now() - startedAt).toBeLessThan(2000);
		expect(admissionCalls(slow)).toHaveLength(1);
		release();
	});

	it("changes nothing in shadow mode", async () => {
		const harness = await run("shadow");
		expect(toolResultText(harness)).toBe(output);
	});

	it("keeps everything when the judge is unsure", async () => {
		const harness = await run("active", new MockJudgeProvider());
		expect(toolResultText(harness)).toBe(output);
	});
});

describe("admission helpers", () => {
	it("chunks on line boundaries and splits a line that is too long on its own", () => {
		expect(chunkLines("aa\nbb\ncc", 5)).toEqual(["aa\nbb", "cc"]);
		expect(chunkLines("abcdefgh", 3)).toEqual(["abc", "def", "gh"]);
	});

	it("describes a call by its command, pattern or path", () => {
		expect(describeCall("bash", { command: "npm test" })).toBe("bash: npm test");
		expect(describeCall("custom", { a: 1 })).toBe('custom: {"a":1}');
	});
});
