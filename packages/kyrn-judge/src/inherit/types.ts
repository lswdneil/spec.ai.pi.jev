/**
 * What spec.jev takes over from the tools a user already set up: Claude Code,
 * Cursor and Codex. Everything here is read-only towards those tools: their
 * folders are never written to.
 */
export type InheritTool = "claude" | "cursor" | "codex" | "mu";

/** `user`: from the home folder, trusted like the user. `project`: from the repository, trusted only when the project is. */
export type InheritScope = "user" | "project";

/** Where to look. Tests point these at fixtures; nothing in `src/inherit` reads `os.homedir()` itself. */
export interface InheritRoots {
	/** The user's home directory. */
	readonly home: string;
	/** The directory the session runs in. */
	readonly projectDir: string;
	/** pi's verdict on the project. Without it nothing from the project is used. */
	readonly projectTrusted: boolean;
}

export interface InheritSwitches {
	readonly claude: boolean;
	readonly cursor: boolean;
	readonly codex: boolean;
	readonly rules: boolean;
	readonly skills: boolean;
	readonly mcp: boolean;
}

export const ALL_SOURCES: InheritSwitches = {
	claude: true,
	cursor: true,
	codex: true,
	rules: true,
	skills: true,
	mcp: true,
};

/**
 * `always`: part of the prompt from the first turn.
 * `glob`: handed over the first time a tool touches a matching file.
 * `described`: only its description is offered; the model reads the file when the topic comes up.
 */
export type RuleMode = "always" | "glob" | "described";

export interface InheritedRule {
	/** Unique within a scan: the file path. */
	readonly path: string;
	readonly tool: InheritTool;
	readonly scope: InheritScope;
	readonly mode: RuleMode;
	readonly description: string;
	/** Patterns relative to `baseDir`. Empty unless `mode` is `glob`. */
	readonly globs: readonly string[];
	/** The folder the patterns are relative to. */
	readonly baseDir: string;
	/** The rule text without its frontmatter. */
	readonly content: string;
}

export interface InheritedSkill {
	readonly name: string;
	/** The folder holding SKILL.md. This is what pi is handed. */
	readonly dir: string;
	readonly tool: InheritTool;
	readonly scope: InheritScope;
}

export interface StdioServer {
	readonly type: "stdio";
	readonly command: string;
	readonly args: readonly string[];
	/** May hold secrets. Never logged, shown or sent anywhere but the child process. */
	readonly env: Readonly<Record<string, string>>;
	readonly cwd?: string;
}

export interface HttpServer {
	readonly type: "http";
	readonly url: string;
	/** May hold secrets. Never logged, shown or sent anywhere but the server itself. */
	readonly headers: Readonly<Record<string, string>>;
}

export interface McpServerDefinition {
	readonly name: string;
	readonly transport: StdioServer | HttpServer;
	/** The file the definition came from. */
	readonly source: string;
	readonly tool: InheritTool;
	readonly scope: InheritScope;
	/** `always` pins the server open; the default is `judged`. Only spec.jev's own section can set it. */
	readonly exposure: "always" | "judged";
	/** Overrides the description built from the server's tools. */
	readonly description?: string;
	readonly startTimeoutMs?: number;
	readonly requestTimeoutMs?: number;
}

/** A definition that exists but will not be used, and why. `/mcp` and `/inherit` show these. */
export interface SkippedServer {
	readonly name: string;
	readonly source: string;
	readonly reason: string;
}

/** A file that could not be used. Reported once, never fatal. The message never quotes file contents. */
export interface InheritProblem {
	readonly source: string;
	readonly message: string;
}
