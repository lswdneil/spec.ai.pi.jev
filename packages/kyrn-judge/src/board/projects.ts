import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Which projects have the plain-language board on, in `<agentDir>/mu/board.json`.
 * The switch is per project and belongs to the user: a repository cannot
 * turn it on for itself (spec.jev reads no settings from a project), because every
 * update of the board costs a model call. Without a directory (tests,
 * embedding) the switches live in memory.
 */
interface BoardFile {
	version: 1;
	projects: Record<string, boolean>;
	/** The model that writes the board, "provider/id" or "session", chosen once for every project. */
	model?: string;
}

export class BoardProjects {
	private readonly file: string | undefined;
	private memory: BoardFile = { version: 1, projects: {} };
	/** The file as last read, by its modification time: it is asked about on every step of the agent. */
	private cached: { stamp: string; value: BoardFile } | undefined;

	constructor(dir: string | undefined) {
		this.file = dir ? join(dir, "board.json") : undefined;
	}

	private read(): BoardFile {
		if (!this.file) return this.memory;
		let stamp: string;
		try {
			const stat = statSync(this.file);
			stamp = `${stat.mtimeMs}:${stat.size}`;
		} catch {
			this.cached = undefined;
			return { version: 1, projects: {} };
		}
		if (this.cached?.stamp === stamp) return this.cached.value;
		let value: BoardFile;
		try {
			const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Partial<BoardFile>;
			value =
				parsed.version !== 1
					? { version: 1, projects: {} }
					: {
							version: 1,
							projects: typeof parsed.projects === "object" && parsed.projects !== null ? parsed.projects : {},
							...(typeof parsed.model === "string" && (parsed.model.includes("/") || parsed.model === "session")
								? { model: parsed.model }
								: {}),
						};
		} catch {
			value = { version: 1, projects: {} };
		}
		this.cached = { stamp, value };
		return value;
	}

	private write(next: BoardFile): void {
		if (!this.file) {
			this.memory = next;
			return;
		}
		mkdirSync(join(this.file, ".."), { recursive: true });
		const temporary = `${this.file}.${process.pid}.tmp`;
		writeFileSync(temporary, `${JSON.stringify(next satisfies BoardFile, null, "\t")}\n`, { mode: 0o600 });
		renameSync(temporary, this.file);
	}

	/** On or off for this project, or undefined when nobody switched it. */
	get(cwd: string): boolean | undefined {
		const value = this.read().projects[resolve(cwd)];
		return typeof value === "boolean" ? value : undefined;
	}

	set(cwd: string, on: boolean): void {
		const current = this.read();
		this.write({ ...current, projects: { ...current.projects, [resolve(cwd)]: on } });
	}

	/** The model chosen for the board, or undefined when nobody chose one yet. */
	model(): string | undefined {
		return this.read().model;
	}

	setModel(ref: string): void {
		this.write({ ...this.read(), model: ref });
	}
}
