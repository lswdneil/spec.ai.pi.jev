import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
export type AgentThinking = (typeof THINKING_LEVELS)[number];

/**
 * A sub-agent role: pi's agent file format (markdown, frontmatter `name`,
 * `description`, `tools`, `model`; the body is the system prompt), plus an
 * optional `thinking`. `model` and `thinking` are pins: leave them out and the
 * judge picks both per task.
 */
export interface AgentDefinition {
	readonly name: string;
	/** What the judge reads to route a task here. Write it as "what kind of task is this". */
	readonly description: string;
	/** Tool allowlist. Undefined means every tool. */
	readonly tools?: readonly string[];
	readonly model?: string;
	readonly thinking?: AgentThinking;
	readonly systemPrompt: string;
	readonly source: "built-in" | "user";
	readonly filePath: string;
}

// A type alias, not an interface: parseFrontmatter wants an index signature.
type AgentFrontmatter = {
	name?: unknown;
	description?: unknown;
	tools?: unknown;
	model?: unknown;
	thinking?: unknown;
};

/** `tools: read, bash` and `tools: [read, bash]` are both in use. */
function parseToolList(value: unknown): string[] | undefined {
	const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
	const tools = raw
		.filter((tool): tool is string => typeof tool === "string")
		.map((tool) => tool.trim())
		.filter(Boolean);
	return tools.length > 0 ? tools : undefined;
}

const NAME = /^[a-z][a-z0-9_-]{0,31}$/;

export function parseAgent(
	content: string,
	source: AgentDefinition["source"],
	filePath: string,
): AgentDefinition | undefined {
	const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(content);
	const { name, description, model, thinking } = frontmatter;
	// The name becomes a judge option and a tool argument, so it must be a plain identifier.
	if (typeof name !== "string" || !NAME.test(name) || name === "other") return undefined;
	if (typeof description !== "string" || !description.trim()) return undefined;
	return {
		name,
		description: description.trim(),
		tools: parseToolList(frontmatter.tools),
		model: typeof model === "string" && model.includes("/") ? model : undefined,
		thinking: THINKING_LEVELS.find((level) => level === thinking),
		systemPrompt: body.trim(),
		source,
		filePath,
	};
}

function loadDir(dir: string, source: AgentDefinition["source"]): AgentDefinition[] {
	let names: string[];
	try {
		names = readdirSync(dir)
			.filter((name) => name.endsWith(".md"))
			.sort();
	} catch {
		return [];
	}
	const agents: AgentDefinition[] = [];
	for (const name of names) {
		const filePath = join(dir, name);
		try {
			// One unreadable or malformed file must not take the other agents down with it.
			const agent = parseAgent(readFileSync(filePath, "utf8"), source, filePath);
			if (agent) agents.push(agent);
		} catch {}
	}
	return agents;
}

/** The roles that ship with spec.jev. Resolves to `<package>/agents` from both `src/` and `dist/`. */
export const BUILT_IN_AGENTS_DIR = fileURLToPath(new URL("../../agents", import.meta.url));

/**
 * Built-in roles plus the user's own in `<agentDir>/agents`. A user file with
 * a built-in's name replaces it. Project directories are deliberately not
 * read: an agent file is a system prompt, and a cloned repository must not
 * get to supply one.
 */
export function loadAgents(userDir: string | undefined, builtInDir: string = BUILT_IN_AGENTS_DIR): AgentDefinition[] {
	const byName = new Map<string, AgentDefinition>();
	for (const agent of loadDir(builtInDir, "built-in")) byName.set(agent.name, agent);
	if (userDir) for (const agent of loadDir(userDir, "user")) byName.set(agent.name, agent);
	return [...byName.values()];
}
