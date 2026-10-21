/**
 * Bringing Claude Code and Codex conversations into spec.jev: finding them on this machine, and turning one transcript into
 * one pi session in spec.jev's session folder, where `/resume`, `spec.jev --session` and the desktop app find it like any other.
 *
 * An imported session starts with a marker entry (IMPORT_MARKER) that names the tool, the transcript and the tool's
 * own id for the conversation; a transcript whose conversation is already in the folder is not imported again.
 *
 * Only node: built-ins at run time, so that `spec.jev import` runs on a bare Node (cli.ts).
 */
import { mkdirSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readClaudeCode } from "./claude-code.ts";
import { environmentCwd, readCodex } from "./codex.ts";
import { readHead, record, str } from "./jsonl.ts";
import {
	absolute,
	type ConvertedTranscript,
	classifyUserText,
	commandText,
	findImport,
	findImports,
	firstLine,
	type ImportCounts,
	type ImportedSession,
	type ImportTool,
	type ReadOptions,
	type SessionStore,
	sessionDirFor,
	sessionFileName,
	writeSessionFile,
} from "./session.ts";

export { readClaudeCode } from "./claude-code.ts";
export { readCodex } from "./codex.ts";
export {
	type ConvertedTranscript,
	findImports,
	IMPORT_CONTEXT,
	IMPORT_MARKER,
	type ImportCounts,
	type ImportOrigin,
	type ImportTool,
	type SessionStore,
	TOOL_NAMES,
} from "./session.ts";

// ---------------------------------------------------------------------------------------------------------------
// Which tool wrote a file
// ---------------------------------------------------------------------------------------------------------------

const CODEX_ITEMS: ReadonlySet<string> = new Set([
	"message",
	"function_call",
	"function_call_output",
	"custom_tool_call",
	"custom_tool_call_output",
	"local_shell_call",
	"reasoning",
]);

/** Claude Code or Codex, from the first lines of the file; undefined for anything else. */
export function detectTool(path: string): ImportTool | undefined {
	let tool: ImportTool | undefined;
	let lines = 0;
	readHead(
		path,
		(value) => {
			lines++;
			const data = record(value);
			if (data) {
				if (record(data.payload) && typeof data.type === "string") tool = "codex";
				else if (
					typeof data.sessionId === "string" ||
					typeof data.uuid === "string" ||
					typeof data.leafUuid === "string"
				)
					tool = "claude-code";
				else if (data.record_type === "state") tool = "codex";
				else if (typeof data.id === "string" && typeof data.timestamp === "string" && data.type === undefined)
					tool = "codex";
				else if (typeof data.type === "string" && CODEX_ITEMS.has(data.type)) tool = "codex";
			}
			return tool !== undefined || lines >= 50;
		},
		4 * 1024 * 1024,
	);
	return tool;
}

// ---------------------------------------------------------------------------------------------------------------
// Finding conversations
// ---------------------------------------------------------------------------------------------------------------

export interface FoundConversation {
	tool: ImportTool;
	/** The transcript. */
	path: string;
	/** The tool's id for the conversation (what an import is recognised by). */
	id: string;
	/** The project folder it was held in. */
	cwd?: string;
	/** The first line the person wrote; empty when none was found near the start of the file. */
	title: string;
	started?: string;
	/** When the transcript last changed. */
	modified: string;
	/** Bytes. */
	size: number;
	/** A thread a sub-agent ran, not a conversation someone had. */
	subAgent: boolean;
	/** The spec.jev session it was already imported as. */
	importedAs?: string;
}

type Described = Pick<FoundConversation, "id" | "cwd" | "title" | "started" | "subAgent">;

const TREE_TYPES: ReadonlySet<string> = new Set(["user", "assistant", "system", "attachment"]);

/** Who a text is from, for a title: the person's first line, or the first command they typed. */
function titleParts(text: string): { title?: string; command?: string } {
	if (classifyUserText(text) !== "user") return {};
	const command = commandText(text);
	if (command !== undefined) return { command };
	if (/^\s*<bash-input>/.test(text)) return {};
	const line = firstLine(text);
	return line ? { title: line } : {};
}

function describeClaudeCode(path: string): Described {
	let id: string | undefined;
	let agentId: string | undefined;
	let cwd: string | undefined;
	let started: string | undefined;
	let title: string | undefined;
	let command: string | undefined;
	let named: string | undefined;
	let first: boolean | undefined;
	readHead(path, (value) => {
		const data = record(value);
		if (!data) return false;
		id ??= str(data.sessionId);
		const type = str(data.type);
		if (type === "custom-title") named ??= str(data.customTitle);
		else if (type === "ai-title") named ??= str(data.aiTitle);
		else if (type === "summary") named ??= str(data.summary);
		if (!type || !TREE_TYPES.has(type)) return false;
		// The first message says whose transcript this is: a sub-agent's has nothing but sidechain records.
		first ??= data.isSidechain === true;
		if (first) agentId ??= str(data.agentId);
		cwd ??= str(data.cwd);
		started ??= str(data.timestamp);
		const own = first || data.isSidechain !== true;
		if (type === "user" && own && data.isMeta !== true && data.isCompactSummary !== true) {
			const message = record(data.message);
			const content = message?.content;
			const texts =
				typeof content === "string"
					? [content]
					: (Array.isArray(content) ? content : [])
							.map((block) => record(block))
							.filter((block) => block?.type === "text")
							.map((block) => str(block?.text) ?? "");
			for (const text of texts) {
				const parts = titleParts(text);
				title ??= parts.title;
				command ??= parts.command;
			}
		}
		return title !== undefined && cwd !== undefined && id !== undefined;
	});
	return {
		id: first && agentId ? `agent-${agentId}` : (id ?? ""),
		cwd,
		title: title ?? named ?? command ?? "",
		started,
		subAgent: first === true,
	};
}

function describeCodex(path: string): Described {
	let id: string | undefined;
	let cwd: string | undefined;
	let started: string | undefined;
	let title: string | undefined;
	let command: string | undefined;
	let subAgent = false;
	let sawMeta = false;
	const visit = (item: Record<string, unknown>) => {
		if (item.type !== "message" || item.role !== "user" || !Array.isArray(item.content)) return;
		for (const block of item.content) {
			const text = str(record(block)?.text);
			if (text === undefined) continue;
			if (classifyUserText(text) === "setup") cwd ??= environmentCwd(text);
			const parts = titleParts(text);
			title ??= parts.title;
			command ??= parts.command;
		}
	};
	readHead(path, (value) => {
		const data = record(value);
		if (!data) return false;
		const payload = record(data.payload);
		const type = str(data.type);
		if (payload && type) {
			if (type === "session_meta" && !sawMeta) {
				sawMeta = true;
				id = str(payload.id) ?? id;
				cwd = str(payload.cwd) ?? cwd;
				started = str(payload.timestamp) ?? str(data.timestamp);
				subAgent = record(payload.source) !== undefined || payload.thread_source === "subagent";
			} else if (type === "turn_context") cwd ??= str(payload.cwd);
			else if (type === "response_item") visit(payload);
		} else if (type) visit(data);
		else if (str(data.id) && str(data.timestamp)) {
			id ??= str(data.id);
			started ??= str(data.timestamp);
		}
		return title !== undefined && cwd !== undefined && id !== undefined;
	});
	const fromName = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(path)?.[1];
	return { id: id ?? fromName ?? "", cwd, title: title ?? command ?? "", started, subAgent };
}

/** Claude Code keeps its home in CLAUDE_CONFIG_DIR when that is set, else in ~/.claude. */
export function claudeProjectsDir(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
	return join(env.CLAUDE_CONFIG_DIR ? absolute(env.CLAUDE_CONFIG_DIR) : join(home, ".claude"), "projects");
}

/** Codex keeps its home in CODEX_HOME when that is set, else in ~/.codex. Archived threads are not listed. */
export function codexSessionsDir(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
	return join(env.CODEX_HOME ? absolute(env.CODEX_HOME) : join(home, ".codex"), "sessions");
}

/** The same folder however it is written (a link, a trailing slash, /tmp and /private/tmp). */
export function sameFolder(a: string, b: string): boolean {
	const canonical = (dir: string) => {
		const path = absolute(dir);
		try {
			return realpathSync.native(path);
		} catch {
			return path;
		}
	};
	return canonical(a) === canonical(b);
}

function jsonlFiles(dir: string, depth: number): string[] {
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const name of names.sort()) {
		const path = join(dir, name);
		if (name.endsWith(".jsonl")) files.push(path);
		else if (depth > 0 && !name.startsWith(".")) {
			try {
				if (statSync(path).isDirectory()) files.push(...jsonlFiles(path, depth - 1));
			} catch {}
		}
	}
	return files;
}

export interface ListOptions {
	/** Only this project's conversations. */
	cwd?: string;
	/** Claude Code's `projects` folder. Default: claudeProjectsDir(). */
	claudeProjects?: string;
	/** Codex's `sessions` folder. Default: codexSessionsDir(). */
	codexSessions?: string;
	/** spec.jev's sessions, to mark what was imported already. */
	store?: SessionStore;
	/** Also list the threads sub-agents ran. */
	subAgents?: boolean;
}

/** The conversations Claude Code and Codex keep on this machine, the most recently changed first. */
export function listConversations(options: ListOptions = {}): FoundConversation[] {
	const claudeProjects = options.claudeProjects ?? claudeProjectsDir();
	const codexSessions = options.codexSessions ?? codexSessionsDir();
	const candidates: { tool: ImportTool; path: string }[] = [];
	// Claude Code: one folder per project, transcripts at its top (sub-agents are in folders below).
	let projects: string[] = [];
	try {
		projects = readdirSync(claudeProjects).sort();
	} catch {}
	for (const project of projects) {
		for (const path of jsonlFiles(join(claudeProjects, project), 0)) candidates.push({ tool: "claude-code", path });
	}
	for (const path of jsonlFiles(codexSessions, 4)) candidates.push({ tool: "codex", path });

	const imported = new Map<string, string>();
	if (options.store) {
		for (const found of findImports(options.store)) {
			imported.set(`${found.origin.tool}:id:${found.origin.sourceId}`, found.sessionFile);
			imported.set(`${found.origin.tool}:path:${found.origin.source}`, found.sessionFile);
		}
	}

	const conversations: FoundConversation[] = [];
	for (const { tool, path } of candidates) {
		let size: number;
		let modified: string;
		try {
			const stats = statSync(path);
			size = stats.size;
			modified = stats.mtime.toISOString();
		} catch {
			continue;
		}
		let described: Described;
		try {
			described = tool === "codex" ? describeCodex(path) : describeClaudeCode(path);
		} catch {
			continue;
		}
		if (described.subAgent && !options.subAgents) continue;
		if (options.cwd && !(described.cwd && sameFolder(described.cwd, options.cwd))) continue;
		const importedAs =
			(described.id ? imported.get(`${tool}:id:${described.id}`) : undefined) ??
			imported.get(`${tool}:path:${path}`);
		conversations.push({ tool, path, ...described, modified, size, ...(importedAs ? { importedAs } : {}) });
	}
	return conversations.sort((a, b) => b.modified.localeCompare(a.modified));
}

// ---------------------------------------------------------------------------------------------------------------
// Importing
// ---------------------------------------------------------------------------------------------------------------

export interface ImportOptions extends SessionStore, ReadOptions {}

export type ImportResult =
	| {
			status: "imported";
			source: string;
			tool: ImportTool;
			sessionFile: string;
			sessionId: string;
			name: string;
			cwd: string;
			counts: ImportCounts;
	  }
	| { status: "already-imported"; source: string; tool: ImportTool; sessionFile: string; sessionId: string }
	| { status: "failed"; source: string; error: string };

/** One transcript as a pi session, without writing anything. */
export async function convertTranscript(path: string, options: ReadOptions = {}): Promise<ConvertedTranscript> {
	const source = absolute(path);
	const tool = detectTool(source);
	if (!tool) throw new Error("not a Claude Code or Codex transcript");
	return tool === "codex" ? readCodex(source, options) : readClaudeCode(source, options);
}

async function importOne(path: string, options: ImportOptions, imports: ImportedSession[]): Promise<ImportResult> {
	const source = absolute(path);
	const failed = (error: string): ImportResult => ({ status: "failed", source, error });
	try {
		if (!statSync(source).isFile()) return failed("not a file");
	} catch {
		return failed("no such file");
	}
	const already = (tool: ImportTool, earlier: ImportedSession): ImportResult => ({
		status: "already-imported",
		source,
		tool,
		sessionFile: earlier.sessionFile,
		sessionId: earlier.sessionId,
	});
	try {
		const tool = detectTool(source);
		if (!tool) return failed("not a Claude Code or Codex transcript");
		// Recognised from the first lines when possible: a Codex rollout can be gigabytes.
		const quick = (tool === "codex" ? describeCodex(source) : describeClaudeCode(source)).id;
		const known = findImport(imports, tool, quick, source);
		if (known) return already(tool, known);
		const converted = tool === "codex" ? await readCodex(source, options) : await readClaudeCode(source, options);
		const earlier = findImport(imports, tool, converted.sourceId, source);
		if (earlier) return already(tool, earlier);
		if (!converted.hasConversation) return failed("no messages in this transcript");
		const dir = sessionDirFor(converted.cwd, options);
		mkdirSync(dir, { recursive: true });
		const sessionFile = join(dir, sessionFileName(converted.started, converted.sessionId));
		writeSessionFile(sessionFile, converted.entries);
		imports.push({
			sessionFile,
			sessionId: converted.sessionId,
			origin: {
				version: 1,
				tool,
				source,
				sourceId: converted.sourceId,
				importedAt: new Date().toISOString(),
				counts: converted.counts,
			},
		});
		return {
			status: "imported",
			source,
			tool,
			sessionFile,
			sessionId: converted.sessionId,
			name: converted.name,
			cwd: converted.cwd,
			counts: converted.counts,
		};
	} catch (error) {
		return failed(error instanceof Error ? error.message : String(error));
	}
}

/** Imports each transcript into the store; one that is there already, or cannot be read, is said so and skipped. */
export async function importTranscripts(paths: readonly string[], options: ImportOptions): Promise<ImportResult[]> {
	const imports = findImports(options);
	const results: ImportResult[] = [];
	for (const path of paths) results.push(await importOne(path, options, imports));
	return results;
}
