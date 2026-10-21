import { join, resolve } from "node:path";
import { projectChain, readBytes, readText } from "./files.ts";
import { type JsonSelection, parseSelected } from "./json-members.ts";
import { readMcpServerTables } from "./toml.ts";
import type {
	HttpServer,
	InheritProblem,
	InheritRoots,
	InheritScope,
	InheritSwitches,
	InheritTool,
	McpServerDefinition,
	SkippedServer,
	StdioServer,
} from "./types.ts";

/**
 * MCP server definitions from every place a user may already have them:
 *
 *   mu.json                        `mcp.servers`                       wins on a name clash
 *   ~/.claude.json                 `projects.<dir>.mcpServers`         the user's own servers for one project
 *   ~/.claude.json                 `mcpServers`
 *   ~/.cursor/mcp.json             `mcpServers`
 *   ~/.codex/config.toml           `[mcp_servers.<name>]`
 *   <project>/.mcp.json            `mcpServers`                        project scope
 *   <project>/.cursor/mcp.json     `mcpServers`                        project scope
 *
 * A project file names commands to run, and a cloned repository must not get
 * to run one: project scope is only read when pi trusts the project, and the
 * MCP feature asks once more before the first start (see `src/mcp/store.ts`).
 * A user-level definition beats a project-level one of the same name, so a
 * repository cannot quietly replace a server the user set up.
 *
 * Values of `env` and `headers` are secrets as far as this code is concerned.
 * No message built here ever quotes a value from a file.
 */
type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> {
	const map: Record<string, string> = {};
	if (!isRecord(value)) return map;
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === "string") map[key] = entry;
		else if (typeof entry === "number" || typeof entry === "boolean") map[key] = String(entry);
	}
	return map;
}

function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

interface Origin {
	readonly source: string;
	readonly tool: InheritTool;
	readonly scope: InheritScope;
}

export interface NormalizeResult {
	readonly server?: McpServerDefinition;
	readonly skipped?: string;
}

/**
 * One definition in any of the spellings: Claude Code and Cursor (`command`/`args`/`env`, `url`/`headers`, `type`),
 * Codex (`http_headers`, `env_http_headers`, `bearer_token_env_var`, `startup_timeout_sec`, `enabled`).
 */
export function normalizeServer(
	name: string,
	raw: unknown,
	origin: Origin,
	env: Readonly<Record<string, string | undefined>>,
): NormalizeResult {
	if (!isRecord(raw)) return { skipped: "its definition is not an object" };
	if (raw.enabled === false || raw.disabled === true) return { skipped: "switched off in its own file" };
	const type = typeof raw.type === "string" ? raw.type.toLowerCase() : undefined;
	const seconds = (value: unknown): number | undefined =>
		typeof value === "number" && value > 0 ? Math.round(value * 1000) : undefined;
	const shared = {
		name,
		source: origin.source,
		tool: origin.tool,
		scope: origin.scope,
		// Pinning a server open is the user's call, made in spec.jev's own file.
		exposure: origin.tool === "mu" && raw.exposure === "always" ? ("always" as const) : ("judged" as const),
		description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : undefined,
		startTimeoutMs:
			seconds(raw.startup_timeout_sec) ??
			(typeof raw.startup_timeout_ms === "number" ? raw.startup_timeout_ms : undefined) ??
			(typeof raw.startTimeoutMs === "number" ? raw.startTimeoutMs : undefined),
		requestTimeoutMs:
			seconds(raw.tool_timeout_sec) ?? (typeof raw.requestTimeoutMs === "number" ? raw.requestTimeoutMs : undefined),
	};

	if (typeof raw.url === "string" && raw.url.trim()) {
		if (type === "sse") return { skipped: "uses the deprecated HTTP+SSE transport, which spec.jev does not speak" };
		const headers = { ...stringMap(raw.headers), ...stringMap(raw.http_headers) };
		// Codex keeps secrets out of the file by naming the variable that holds them.
		for (const [header, variable] of Object.entries(stringMap(raw.env_http_headers))) {
			const value = env[variable];
			if (value) headers[header] = value;
		}
		if (typeof raw.bearer_token_env_var === "string") {
			const token = env[raw.bearer_token_env_var];
			if (token) headers.Authorization = `Bearer ${token}`;
		}
		const transport: HttpServer = { type: "http", url: raw.url.trim(), headers };
		return { server: { ...shared, transport } };
	}
	if (typeof raw.command === "string" && raw.command.trim()) {
		if (type && type !== "stdio") return { skipped: `has a command but says its type is "${type}"` };
		const transport: StdioServer = {
			type: "stdio",
			command: raw.command.trim(),
			args: stringList(raw.args),
			env: stringMap(raw.env),
			cwd: typeof raw.cwd === "string" && raw.cwd.trim() ? raw.cwd : undefined,
		};
		return { server: { ...shared, transport } };
	}
	return { skipped: "has neither a command nor a url" };
}

/** What the user set for a server in mu.json without redefining it: `{ "exposure": "always" }`, `{ "enabled": false }`. */
interface Overlay {
	readonly exposure?: "always" | "judged";
	readonly enabled?: boolean;
	readonly description?: string;
}

function overlayOf(raw: unknown): Overlay | undefined {
	if (!isRecord(raw) || typeof raw.command === "string" || typeof raw.url === "string") return undefined;
	return {
		exposure: raw.exposure === "always" || raw.exposure === "judged" ? raw.exposure : undefined,
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : undefined,
		description: typeof raw.description === "string" ? raw.description : undefined,
	};
}

/** The selected members of the object in a JSON file (see `parseSelected`); the rest of the file is never built. */
function parseJson(path: string, problems: InheritProblem[], selection: JsonSelection): Json | undefined {
	const bytes = readBytes(path, problems, 32 * 1024 * 1024);
	if (bytes === undefined) return undefined;
	try {
		const parsed = parseSelected(bytes, selection);
		if (parsed) return parsed;
		problems.push({ source: path, message: "skipped: it does not hold a JSON object" });
	} catch {
		// The parser's message can quote the file, and the file can hold tokens.
		problems.push({ source: path, message: "skipped: it is not valid JSON" });
	}
	return undefined;
}

/** `/a/b` and `C:\a\b` compared the way Claude Code writes project keys: forward slashes, no trailing one. */
function pathKey(path: string, platform: NodeJS.Platform): string {
	const key = path.replace(/\\/g, "/").replace(/\/+$/, "");
	return platform === "win32" ? key.toLowerCase() : key;
}

export interface McpDiscovery {
	readonly servers: McpServerDefinition[];
	readonly skipped: SkippedServer[];
}

export interface McpDiscoveryOptions {
	readonly roots: InheritRoots;
	readonly switches: InheritSwitches;
	/** The `mcp` section of mu.json, as parsed JSON. Read even when every inherited source is switched off. */
	readonly own?: unknown;
	/** Where `own` came from, for display. */
	readonly ownSource?: string;
	readonly env?: Readonly<Record<string, string | undefined>>;
	readonly platform?: NodeJS.Platform;
}

export function discoverMcpServers(options: McpDiscoveryOptions, problems: InheritProblem[]): McpDiscovery {
	const { roots, switches } = options;
	const env = options.env ?? {};
	const platform = options.platform ?? process.platform;
	const servers = new Map<string, McpServerDefinition>();
	const skipped: SkippedServer[] = [];
	const overlays = new Map<string, Overlay>();

	const add = (entries: unknown, origin: Origin, disabled: ReadonlySet<string> = new Set()): void => {
		if (!isRecord(entries)) return;
		for (const [name, raw] of Object.entries(entries)) {
			if (origin.tool === "mu") {
				const overlay = overlayOf(raw);
				if (overlay) {
					overlays.set(name, overlay);
					continue;
				}
			}
			const existing = servers.get(name);
			if (existing) {
				skipped.push({
					name,
					source: origin.source,
					reason: `the definition in ${existing.source} is used instead`,
				});
				continue;
			}
			if (disabled.has(name)) {
				skipped.push({ name, source: origin.source, reason: "switched off for this project in Claude Code" });
				continue;
			}
			const result = normalizeServer(name, raw, origin, env);
			if (result.server) servers.set(name, result.server);
			else skipped.push({ name, source: origin.source, reason: result.skipped ?? "unusable" });
		}
	};

	const own = isRecord(options.own) ? options.own : undefined;
	add(own?.servers, { source: options.ownSource ?? "mu.json", tool: "mu", scope: "user" });

	const chain = projectChain(roots.projectDir, roots.home);
	const inherit = switches.mcp;
	let disabledInClaude = new Set<string>();
	if (inherit && switches.claude) {
		const path = join(roots.home, ".claude.json");
		// The user's own servers for this project, nearest folder first. They live in the home folder, so they are the user's.
		const dirs = [resolve(roots.projectDir), ...chain.slice(1)];
		const wanted = new Set(dirs.map((dir) => pathKey(dir, platform)));
		// Every project Claude Code has seen is in this file, with its prompt history. Only this project's are built.
		const config = parseJson(path, problems, {
			mcpServers: true,
			projects: (key) => wanted.has(pathKey(key, platform)),
		});
		if (config) {
			const projects = isRecord(config.projects) ? config.projects : {};
			const keys = new Map(Object.keys(projects).map((key) => [pathKey(key, platform), key]));
			for (const dir of dirs) {
				const key = keys.get(pathKey(dir, platform));
				const project = key ? projects[key] : undefined;
				if (!isRecord(project)) continue;
				disabledInClaude = new Set([
					...disabledInClaude,
					...stringList(project.disabledMcpServers),
					...stringList(project.disabledMcpjsonServers),
				]);
				add(project.mcpServers, { source: path, tool: "claude", scope: "user" }, disabledInClaude);
			}
			add(config.mcpServers, { source: path, tool: "claude", scope: "user" }, disabledInClaude);
		}
	}
	if (inherit && switches.cursor) {
		const path = join(roots.home, ".cursor", "mcp.json");
		add(parseJson(path, problems, { mcpServers: true })?.mcpServers, { source: path, tool: "cursor", scope: "user" });
	}
	if (inherit && switches.codex) {
		const path = join(roots.home, ".codex", "config.toml");
		const text = readText(path, problems);
		if (text !== undefined) {
			try {
				add(readMcpServerTables(text), { source: path, tool: "codex", scope: "user" });
			} catch (error) {
				// The reader's messages name a line, never its content.
				const detail = error instanceof Error ? error.message : "unreadable";
				problems.push({ source: path, message: `skipped: ${detail}` });
			}
		}
	}

	if (inherit) {
		const userFiles = new Set([resolve(join(roots.home, ".cursor", "mcp.json"))]);
		for (const dir of chain) {
			const files: { path: string; tool: InheritTool; on: boolean }[] = [
				{ path: join(dir, ".mcp.json"), tool: "claude", on: switches.claude },
				{ path: join(dir, ".cursor", "mcp.json"), tool: "cursor", on: switches.cursor },
			];
			for (const file of files) {
				if (!file.on || userFiles.has(resolve(file.path))) continue;
				if (!roots.projectTrusted) {
					// Not even parsed: an untrusted folder gets no say. Its existence is worth telling the user, though.
					if (readText(file.path, []) !== undefined) {
						skipped.push({ name: "*", source: file.path, reason: "the project is not trusted" });
					}
					continue;
				}
				add(
					parseJson(file.path, problems, { mcpServers: true })?.mcpServers,
					{ source: file.path, tool: file.tool, scope: "project" },
					disabledInClaude,
				);
			}
		}
	}

	const result: McpServerDefinition[] = [];
	for (const server of servers.values()) {
		const overlay = overlays.get(server.name);
		if (overlay?.enabled === false) {
			skipped.push({ name: server.name, source: server.source, reason: "switched off in mu.json" });
			continue;
		}
		result.push({
			...server,
			exposure: overlay?.exposure ?? server.exposure,
			description: overlay?.description ?? server.description,
		});
	}
	return { servers: result, skipped };
}

/**
 * `${VAR}`, `${VAR:-fallback}` (Claude Code), `${env:VAR}`, `${workspaceFolder}` and `${userHome}` (Cursor).
 * Done when a server starts, not when its file is read, so a secret from the environment is never kept around.
 * An unset variable without a fallback becomes an empty string.
 */
export function expandPlaceholders(
	value: string,
	context: { env: Readonly<Record<string, string | undefined>>; projectDir: string; home: string },
): string {
	return value.replace(/\$\{([^}]+)\}/g, (_whole, body: string) => {
		if (body === "workspaceFolder") return context.projectDir;
		if (body === "userHome") return context.home;
		const expression = body.startsWith("env:") ? body.slice(4) : body;
		const split = expression.indexOf(":-");
		const name = split === -1 ? expression : expression.slice(0, split);
		return context.env[name] ?? (split === -1 ? "" : expression.slice(split + 2));
	});
}
