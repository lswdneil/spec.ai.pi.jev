import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { discoverMcpServers, type McpDiscovery } from "./mcp-config.ts";
import { discoverRules } from "./rules.ts";
import { discoverSkills } from "./skills.ts";
import {
	ALL_SOURCES,
	type InheritedRule,
	type InheritedSkill,
	type InheritProblem,
	type InheritRoots,
	type InheritSwitches,
	type InheritTool,
} from "./types.ts";

export interface InheritanceScan extends McpDiscovery {
	readonly rules: InheritedRule[];
	readonly skills: InheritedSkill[];
	readonly problems: InheritProblem[];
}

export interface ScanOptions {
	readonly roots: InheritRoots;
	readonly switches?: Partial<InheritSwitches>;
	/** The `mcp` section of mu.json. */
	readonly own?: unknown;
	readonly ownSource?: string;
	/** Folders pi loads skills from by itself. */
	readonly piSkillDirs?: readonly string[];
	readonly env?: Readonly<Record<string, string | undefined>>;
	readonly platform?: NodeJS.Platform;
}

/** Everything inherited, in one pass. Never throws: a file that cannot be used becomes a line in `problems`. */
export function scanInheritance(options: ScanOptions): InheritanceScan {
	const switches: InheritSwitches = { ...ALL_SOURCES, ...options.switches };
	const problems: InheritProblem[] = [];
	const guarded = <T>(what: string, work: () => T, empty: T): T => {
		try {
			return work();
		} catch (error) {
			problems.push({ source: what, message: error instanceof Error ? error.message.slice(0, 120) : "failed" });
			return empty;
		}
	};
	const rules = guarded("rules", () => discoverRules(options.roots, switches, problems), []);
	const skills = guarded("skills", () => discoverSkills(options.roots, switches, problems, options.piSkillDirs), []);
	const mcp = guarded(
		"mcp",
		() =>
			discoverMcpServers(
				{
					roots: options.roots,
					switches,
					own: options.own,
					ownSource: options.ownSource,
					env: options.env,
					platform: options.platform,
				},
				problems,
			),
		{ servers: [], skipped: [] },
	);
	return { rules, skills, servers: mcp.servers, skipped: mcp.skipped, problems };
}

const TOOL_NAMES: Readonly<Record<InheritTool, string>> = {
	claude: "Claude Code",
	cursor: "Cursor",
	codex: "Codex",
	mu: "spec.jev",
};

/** "Inherited 3 rules, 12 skills and 2 MCP servers from Claude Code and Cursor." Undefined when nothing was inherited. */
export function inheritanceSummary(scan: InheritanceScan): string | undefined {
	const servers = scan.servers.filter((server) => server.tool !== "mu");
	const counted: [number, string][] = [
		[scan.rules.length, "rule"],
		[scan.skills.length, "skill"],
		[servers.length, "MCP server"],
	];
	const parts = counted
		.filter(([count]) => count > 0)
		.map(([count, noun]) => `${count} ${noun}${count === 1 ? "" : "s"}`);
	if (parts.length === 0) return undefined;
	const tools = new Set<InheritTool>([
		...scan.rules.map((rule) => rule.tool),
		...scan.skills.map((skill) => skill.tool),
		...servers.map((server) => server.tool),
	]);
	const from = (["claude", "cursor", "codex"] as const)
		.filter((tool) => tools.has(tool))
		.map((tool) => TOOL_NAMES[tool]);
	const list = (items: string[]) =>
		items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
	return `Inherited ${list(parts)} from ${list(from)}.`;
}

/** What `<agentDir>/mu/inherit.json` remembers: that the first-run notice was shown. */
export interface InheritState {
	readonly noticeShownAt?: string;
}

export function inheritStatePath(agentDir: string): string {
	return join(agentDir, "mu", "inherit.json");
}

export function readInheritState(agentDir: string): InheritState {
	try {
		const parsed: unknown = JSON.parse(readFileSync(inheritStatePath(agentDir), "utf8"));
		if (typeof parsed === "object" && parsed !== null && "noticeShownAt" in parsed) {
			const shown = (parsed as { noticeShownAt?: unknown }).noticeShownAt;
			return { noticeShownAt: typeof shown === "string" ? shown : undefined };
		}
	} catch {
		// Missing or damaged: the notice is simply shown once more.
	}
	return {};
}

export function writeInheritState(agentDir: string, state: InheritState): void {
	const path = inheritStatePath(agentDir);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(state, null, "\t")}\n`);
}
