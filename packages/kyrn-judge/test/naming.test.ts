import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findChrome } from "../src/browser/chrome.ts";
import { loadConfig } from "../src/config.ts";
import { VERDICT_ENTRY } from "../src/extension/features/preflight-view.ts";
import { PRESENTATION_STATUS_KEY } from "../src/extension/presentation.ts";
import { LEDGER_ENTRY_TYPE } from "../src/extension/runtime.ts";
import { muEnv, muHome } from "../src/naming.ts";
import { HIVE_MESSAGE, SWARM_MESSAGE } from "../src/swarm/markers.ts";

const dirs: string[] = [];
function temp(): string {
	const dir = mkdtempSync(join(tmpdir(), "spec-jev-naming-"));
	dirs.push(dir);
	return dir;
}
afterEach(() => {
	while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe("spec.jev's names", () => {
	it("reads a setting only under its own name", () => {
		expect(muEnv("JUDGE", { SPECJEV_JUDGE: "laya" })).toBe("laya");
		expect(muEnv("JUDGE", { MU_JUDGE: "jev" })).toBeUndefined();
		expect(muEnv("JUDGE", { KYRN_JUDGE: "jev" })).toBeUndefined();
		expect(muEnv("JUDGE", { SPECJEV_JUDGE: "", MU_JUDGE: "jev" })).toBeUndefined();
		expect(muEnv("JUDGE", {})).toBeUndefined();
	});

	it("applies the judge, mode and writer overrides", () => {
		const current = loadConfig({ env: { SPECJEV_JUDGE: "laya,gateway", SPECJEV_JUDGE_MODE: "active", SPECJEV_WRITER: "p/m" } });
		expect(current.config).toMatchObject({ tiers: ["laya", "jev"], modes: { default: "active" }, writer: "p/m" });

		expect(loadConfig({ env: { MU_JUDGE: "laya" } }).config.tiers).toEqual(["jev"]);
		expect(loadConfig({ env: { SPECJEV_JUDGE: "off" } }).disabled).toBe(true);
		expect(loadConfig({ env: { SPECJEV_JUDGE: "laya", MU_JUDGE: "off" } }).disabled).toBe(false);
	});

	it("reads spec.jev.json and nothing else", () => {
		const dir = temp();
		writeFileSync(join(dir, "mu.json"), JSON.stringify({ tiers: ["old"] }));
		writeFileSync(join(dir, "kyrn.json"), JSON.stringify({ tiers: ["older"] }));
		expect(loadConfig({ dir, env: {} }).config.tiers).toEqual(["jev"]);

		writeFileSync(join(dir, "spec.jev.json"), JSON.stringify({ tiers: ["new"] }));
		expect(loadConfig({ dir, env: {} }).config.tiers).toEqual(["new"]);
	});

	it("reports a broken spec.jev.json", () => {
		const dir = temp();
		writeFileSync(join(dir, "mu.json"), JSON.stringify({ tiers: ["old"] }));
		writeFileSync(join(dir, "spec.jev.json"), "{ not json");

		const loaded = loadConfig({ dir, env: {} });

		expect(loaded.problem).toMatch(/^spec\.jev\.json could not be read/);
		expect(loaded.config.tiers).toEqual(["jev"]);
	});

	it("always uses ~/.spec.jev, whatever older folders exist", () => {
		const fresh = temp();
		expect(muHome(fresh)).toBe(join(fresh, ".spec.jev"));

		const withOld = temp();
		mkdirSync(join(withOld, ".mu"));
		mkdirSync(join(withOld, ".kyrn"));
		expect(muHome(withOld)).toBe(join(withOld, ".spec.jev"));
	});

	it("finds the browser named by SPECJEV_CHROME", () => {
		const chrome = join(temp(), "chrome");
		writeFileSync(chrome, "");
		expect(findChrome({ SPECJEV_CHROME: chrome })).toBe(chrome);
	});

	it("leaves every name that is already stored in sessions and desktop event logs as it was", () => {
		// Renaming any of these orphans history: compaction would quote them as user text, forgetting would
		// not restore, verdict lines would not render, and the desktop would drop the events without an error.
		expect({ LEDGER_ENTRY_TYPE, VERDICT_ENTRY, PRESENTATION_STATUS_KEY, HIVE_MESSAGE, SWARM_MESSAGE }).toEqual({
			LEDGER_ENTRY_TYPE: "kyrn.decision",
			VERDICT_ENTRY: "kyrn.verdict",
			PRESENTATION_STATUS_KEY: "kyrn.presentation.v1",
			HIVE_MESSAGE: "kyrn.hive",
			SWARM_MESSAGE: "kyrn.swarm",
		});
	});
});
