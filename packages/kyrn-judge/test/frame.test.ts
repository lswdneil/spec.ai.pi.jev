import { describe, expect, it } from "vitest";
import {
	addItem,
	compactFrame,
	createFrame,
	describeFrame,
	type Frame,
	type FrameState,
	frameEntry,
	isStale,
	openItems,
	openQuestionCode,
	parseFrameEntry,
	renderFrameNote,
	ruleUpdate,
	tickItem,
	withEntryId,
} from "../src/frame/frame.ts";
import { findVerbatim, mergeWriterFrame, parseWriterReply, sentencesOf, writerRequest } from "../src/frame/writer.ts";

const first = createFrame({ text: "Add pagination to the users API", turn: 1 });
const PRD_EXAMPLE = "保留原方案，但取消数据库变更";

function withItems(frame: Frame, ...texts: string[]): Frame {
	return texts.reduce((current, text) => {
		const added = addItem(current, text, "model");
		if ("error" in added) throw new Error(added.error);
		return added.frame;
	}, frame);
}

describe("task frame model", () => {
	it("makes version 1 from the first message, with nothing invented", () => {
		expect(first).toMatchObject({
			version: 1,
			goal: "Add pagination to the users API",
			constraints: [],
			acceptance: [],
			openQuestions: [],
			updatedTurn: 1,
			source: "first-message",
		});
	});

	it("rules: a correction is kept word for word with its source, and the goal stays", () => {
		const next = ruleUpdate(first, { text: PRD_EXAMPLE, turn: 3, entryId: "e3", change: "correction" });
		expect(next.version).toBe(2);
		expect(next.goal).toBe(first.goal);
		expect(next.constraints).toEqual([{ text: PRD_EXAMPLE, source: { turn: 3, entryId: "e3" } }]);
		expect(next).toMatchObject({ source: "rules", change: "correction", updatedTurn: 3 });
		// Saying it again does not list it twice.
		expect(ruleUpdate(next, { text: PRD_EXAMPLE, turn: 4, change: "constraint" }).constraints).toHaveLength(1);
	});

	it("rules: a new task replaces goal and checklist but keeps the constraints", () => {
		const constrained = ruleUpdate(withItems(first, "pages are stable"), {
			text: "never commit without asking",
			turn: 2,
			change: "constraint",
		});
		const next = ruleUpdate(constrained, { text: "Now fix the CSS of the header", turn: 3, change: "new_task" });
		expect(next.goal).toBe("Now fix the CSS of the header");
		expect(next.acceptance).toEqual([]);
		expect(next.constraints.map((constraint) => constraint.text)).toEqual(["never commit without asking"]);
		// Ids are not handed out twice, even after the list was cleared.
		expect(withItems(next, "header is aligned").acceptance[0].id).toBe("a2");
	});

	it("rules: a subgoal is set, and an unclear change becomes a question instead of replacing the goal", () => {
		expect(ruleUpdate(first, { text: "start with the SQL query", turn: 2, change: "subgoal" }).currentSubgoal).toBe(
			"start with the SQL query",
		);
		const unclear = ruleUpdate(first, { text: "and the admin page?", turn: 2, change: "unclear" });
		expect(unclear.goal).toBe(first.goal);
		expect(unclear.openQuestions).toEqual(['How does this change the task: "and the admin page?"?']);
		// The rules' question has a code for a client that translates; a question the writer wrote is its own words.
		expect(unclear.openQuestions.map(openQuestionCode)).toEqual([
			{ code: "unclear_change", params: { message: "and the admin page?" } },
		]);
		expect(openQuestionCode("Which database should the importer use?")).toBeNull();
	});

	it("rules: an over-long message is cut, never reworded, and says so", () => {
		const long = `do not touch the schema. ${"x".repeat(1500)}`;
		const [constraint] = ruleUpdate(first, { text: long, turn: 2, change: "constraint" }).constraints;
		expect(constraint.partial).toBe(true);
		expect(long.startsWith(constraint.text)).toBe(true);
	});

	it("ticks and adds without bumping the version, and refuses what it cannot do", () => {
		const frame = withItems(first, "tests pass", "docs updated");
		const ticked = tickItem(frame, "A1", "vitest: 12 passed", "model");
		if ("error" in ticked) throw new Error(ticked.error);
		expect(ticked.frame.version).toBe(1);
		expect(ticked.item).toMatchObject({ id: "a1", done: true, doneBy: "model", evidence: "vitest: 12 passed" });
		expect(openItems(ticked.frame).map((item) => item.id)).toEqual(["a2"]);
		expect(tickItem(frame, "a9", "x", "model")).toEqual({ error: expect.stringContaining("Known ids: a1, a2") });
		expect(tickItem(frame, "a1", " ", "model")).toEqual({ error: expect.stringContaining("evidence") });
		expect(addItem(frame, "tests pass", "model")).toEqual({ error: expect.stringContaining("a1") });
		expect(addItem(frame, "  ", "model")).toHaveProperty("error");
	});

	it("compact view: what nobody judged shows as the latest message, exactly like the old stand-in", () => {
		expect(compactFrame({ unmerged: [] })).toBeUndefined();
		expect(compactFrame({ frame: first, unmerged: [] })).toEqual({
			goal: "Add pagination to the users API",
			currentSubgoal: undefined,
		});
		const unjudged: FrameState = {
			frame: first,
			unmerged: [{ text: "write the SQL first", turn: 2, reason: "unjudged" }],
		};
		expect(compactFrame(unjudged)).toEqual({ goal: first.goal, currentSubgoal: "write the SQL first" });
		expect(isStale(unjudged)).toBe(false);
		// The first message said again is not a subgoal of itself.
		expect(
			compactFrame({ frame: first, unmerged: [{ text: first.goal, turn: 2, reason: "unjudged" }] })?.currentSubgoal,
		).toBeUndefined();
	});

	it("compact view: a failed update keeps the last version and shows the new words the way the rules would", () => {
		const state: FrameState = {
			frame: first,
			unmerged: [{ text: PRD_EXAMPLE, turn: 3, change: "correction", reason: "failed" }],
		};
		expect(isStale(state)).toBe(true);
		expect(state.frame?.version).toBe(1);
		expect(compactFrame(state)).toEqual({ goal: first.goal, constraints: [PRD_EXAMPLE], currentSubgoal: undefined });
		expect(isStale({ frame: first, unmerged: [{ text: "x", turn: 2, reason: "late" }] })).toBe(true);
		expect(renderFrameNote(state)).toContain("not merged into the frame yet");
		expect(describeFrame(state)).toContain("STALE");
	});

	it("renders a short note and a full description", () => {
		const ticked = tickItem(withItems(first, "tests pass"), "a1", "12 passed", "model");
		if ("error" in ticked) throw new Error(ticked.error);
		const frame = ruleUpdate(ticked.frame, { text: PRD_EXAMPLE, turn: 3, entryId: "abc", change: "correction" });
		const note = renderFrameNote({ frame, unmerged: [] });
		expect(note).toContain("[spec.jev task frame v2]");
		expect(note).toContain(`- "${PRD_EXAMPLE}" (turn 3)`);
		expect(note).toContain("- [x] a1 tests pass");
		const text = describeFrame({ frame, unmerged: [] });
		expect(text).toContain("task frame v2 · updated at turn 3 · rules, correction");
		expect(text).toContain("(turn 3, entry abc)");
		expect(text).toContain("12 passed (model)");
		expect(describeFrame({ unmerged: [] })).toContain("No task frame yet");
	});

	it("fills in the entry id of the message a constraint was taken from", () => {
		const frame = ruleUpdate(first, { text: "never commit", turn: 2, change: "constraint" });
		const state: FrameState = { frame, unmerged: [{ text: "more", turn: 2, reason: "failed", change: "subgoal" }] };
		const other = withEntryId(state, { turn: 2, text: "something else entirely", entryId: "zz" });
		expect(other.frame?.constraints[0].source.entryId).toBeUndefined();
		const patched = withEntryId(state, { turn: 2, text: "please never commit, ok", entryId: "e2" });
		expect(patched.frame?.constraints[0].source).toEqual({ turn: 2, entryId: "e2" });
		expect(withEntryId(state, { turn: 2, text: "more", entryId: "e9" }).unmerged[0].entryId).toBe("e9");
	});

	it("stores what failed but not what is merely late, and refuses entries it did not write", () => {
		const state: FrameState = {
			frame: first,
			unmerged: [
				{ text: "a", turn: 2, reason: "failed", change: "constraint" },
				{ text: "b", turn: 3, reason: "late" },
			],
		};
		const entry = frameEntry(state, "stale");
		expect(entry?.unmerged.map((said) => said.text)).toEqual(["a"]);
		expect(parseFrameEntry(JSON.parse(JSON.stringify(entry)))).toEqual({ frame: first, unmerged: entry?.unmerged });
		expect(frameEntry({ unmerged: [] }, "created")).toBeUndefined();
		for (const broken of [
			null,
			"frame",
			{ schema: 2, frame: first },
			{ schema: 1, frame: { ...first, goal: 7 } },
			{ schema: 1, frame: { ...first, constraints: [{ text: "x" }] } },
			{ schema: 1, frame: { ...first, version: 0 } },
		]) {
			expect(parseFrameEntry(broken)).toBeUndefined();
		}
	});
});

describe("task frame writer contract", () => {
	const reply = (value: unknown) => JSON.stringify(value);
	const base = { goal: first.goal, constraints: [], current_subgoal: null, acceptance: [], open_questions: [] };

	it("shows the writer the frame and how the judge read the message", () => {
		const request = writerRequest(first, [{ text: PRD_EXAMPLE, turn: 3, change: "correction" }]);
		expect(request.system).toContain("WORD FOR WORD");
		expect(request.user).toContain('"goal": "Add pagination to the users API"');
		expect(request.user).toContain(`turn 3, read by the judge as: correction):\n${PRD_EXAMPLE}`);
	});

	it("parses a fenced reply and refuses everything malformed", () => {
		const parsed = parseWriterReply(
			`\`\`\`json\n${reply({ ...base, acceptance: ["a", { id: "a1", text: "b" }] })}\n\`\`\``,
		);
		expect(parsed).toEqual({
			ok: true,
			value: {
				goal: first.goal,
				constraints: [],
				currentSubgoal: undefined,
				acceptance: [{ text: "a" }, { id: "a1", text: "b" }],
				openQuestions: [],
			},
		});
		for (const bad of [
			"I updated the frame.",
			'{"goal": "x", "constraints": [',
			reply({ ...base, goal: "  " }),
			reply({ ...base, constraints: "none" }),
			reply({ ...base, constraints: [1] }),
			reply({ ...base, current_subgoal: 4 }),
			reply({ ...base, acceptance: [{ id: "a1" }] }),
			reply({ ...base, acceptance: [{ id: 3, text: "x" }] }),
			reply({ goal: "x", constraints: [], acceptance: [] }),
		]) {
			expect(parseWriterReply(bad).ok, bad).toBe(false);
		}
	});

	it("finds the user's words despite line breaks, quotes and a final full stop, and nothing else", () => {
		const said = "Looks good.\nKeep the public  API\nas it is, please.";
		expect(findVerbatim(said, '"Keep the public API as it is."')).toBe("Keep the public  API\nas it is");
		expect(findVerbatim(said, "Do not change the public API")).toBeUndefined();
		expect(findVerbatim(PRD_EXAMPLE, "取消数据库变更。")).toBe("取消数据库变更");
		expect(sentencesOf("Use v2.1 of src/a.ts. Then run it!\n好的。先别改")).toEqual([
			"Use v2.1 of src/a.ts.",
			"Then run it!",
			"好的。",
			"先别改",
		]);
	});

	it("a paraphrased constraint is replaced by the sentence the user wrote", () => {
		const said = [
			{
				text: `这个方案可以。${PRD_EXAMPLE}。另外记得跑测试。`,
				turn: 3,
				entryId: "e3",
				change: "correction" as const,
			},
		];
		const merged = mergeWriterFrame(
			first,
			{ goal: first.goal, constraints: ["不要修改数据库"], acceptance: [], openQuestions: [] },
			said,
		);
		expect(merged.version).toBe(2);
		expect(merged.constraints).toEqual([{ text: `${PRD_EXAMPLE}。`, source: { turn: 3, entryId: "e3" } }]);
		expect(JSON.stringify(merged)).not.toContain("不要修改数据库");
		expect(merged).toMatchObject({ source: "writer", change: "correction", updatedTurn: 3 });
	});

	it("words that are nowhere in the message become a question, and the message itself is kept as the constraint", () => {
		const said = [{ text: "别动数据库", turn: 2, change: "constraint" as const }];
		const merged = mergeWriterFrame(
			first,
			{ goal: first.goal, constraints: ["Use PostgreSQL 16 only"], acceptance: [], openQuestions: [] },
			said,
		);
		expect(merged.constraints.map((constraint) => constraint.text)).toEqual(["别动数据库"]);
		expect(merged.openQuestions).toEqual([
			'Not the user\'s words, so not recorded as a constraint: "Use PostgreSQL 16 only"',
		]);
	});

	it("never loses a constraint or a checklist item as a side effect, only when the user replaced or corrected", () => {
		const frame = ruleUpdate(withItems(first, "tests pass", "docs updated"), {
			text: "never commit without asking",
			turn: 2,
			change: "constraint",
		});
		const ticked = tickItem(frame, "a1", "12 passed", "model");
		if ("error" in ticked) throw new Error(ticked.error);
		const forgetful = { goal: frame.goal, constraints: [], acceptance: [], openQuestions: [] };

		const subgoal = mergeWriterFrame(ticked.frame, { ...forgetful, currentSubgoal: "the SQL query" }, [
			{ text: "start with the SQL query", turn: 3, change: "subgoal" },
		]);
		expect(subgoal.constraints.map((constraint) => constraint.text)).toEqual(["never commit without asking"]);
		expect(subgoal.acceptance.map((item) => [item.id, item.done])).toEqual([
			["a1", true],
			["a2", false],
		]);
		expect(subgoal.currentSubgoal).toBe("the SQL query");

		const replaced = mergeWriterFrame(ticked.frame, { ...forgetful, goal: "Fix the header CSS" }, [
			{ text: "forget that, fix the header CSS", turn: 3, change: "new_task" },
		]);
		expect(replaced.constraints).toEqual([]);
		expect(replaced.acceptance).toEqual([]);
	});

	it("keeps ticks on items the writer kept, resets a reworded one, and numbers new ones onwards", () => {
		const ticked = tickItem(withItems(first, "tests pass", "docs updated"), "a1", "12 passed", "model");
		if ("error" in ticked) throw new Error(ticked.error);
		const redone = tickItem(ticked.frame, "a2", "README changed", "model");
		if ("error" in redone) throw new Error(redone.error);
		const merged = mergeWriterFrame(
			redone.frame,
			{
				goal: first.goal,
				constraints: [],
				acceptance: [
					{ id: "a1", text: "tests pass" },
					{ id: "a2", text: "docs and changelog updated" },
					{ text: "cursor is opaque" },
					{ id: "a7", text: "limit is capped at 100" },
				],
				openQuestions: [],
			},
			[{ text: "also make the cursor opaque", turn: 4, change: "subgoal" }],
		);
		expect(merged.acceptance).toEqual([
			{ id: "a1", text: "tests pass", done: true, doneBy: "model", evidence: "12 passed", addedBy: "model" },
			{ id: "a2", text: "docs and changelog updated", done: false, addedBy: "model" },
			{ id: "a3", text: "cursor is opaque", done: false, addedBy: "writer" },
			{ id: "a4", text: "limit is capped at 100", done: false, addedBy: "writer" },
		]);
		expect(merged.nextItem).toBe(5);
	});
});
