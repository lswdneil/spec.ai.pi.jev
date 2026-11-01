import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import spawnCrossPlatform from "cross-spawn";
import { stripBom } from "../../utils/text.ts";

export interface ExternalEditorOptions {
	command: string;
	content: string;
}

export type ExternalEditorResult = { status: "complete"; content: string } | { status: "failed" };

function splitCommandLine(command: string): string[] {
	const parts: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;
	const flush = (): void => {
		if (current) {
			parts.push(current);
			current = "";
		}
	};
	for (const char of command) {
		if (quote) {
			if (char === quote) quote = null;
			else current += char;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (/\s/.test(char)) {
			flush();
		} else {
			current += char;
		}
	}
	flush();
	return parts;
}

function parseEditorCommand(command: string, filePath: string): { executable: string; args: string[] } {
	const trimmed = command.trim();
	if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
		const [executable = "", ...args] = splitCommandLine(trimmed);
		return { executable, args: [...args, filePath] };
	}
	if (existsSync(trimmed) && statSync(trimmed).isFile()) {
		return { executable: trimmed, args: [filePath] };
	}

	// A Windows executable path may contain spaces and arrive unquoted. Prefer
	// the longest prefix that exists on disk before treating the first token as
	// the command.
	for (let index = trimmed.length - 1; index > 0; index--) {
		if (!/\s/.test(trimmed[index])) continue;
		const executable = trimmed.slice(0, index).trim();
		if (!executable || !existsSync(executable) || !statSync(executable).isFile()) continue;
		return { executable, args: [...splitCommandLine(trimmed.slice(index + 1)), filePath] };
	}

	const [executable = "", ...args] = splitCommandLine(trimmed);
	return { executable, args: [...args, filePath] };
}

export async function editInExternalEditor(options: ExternalEditorOptions): Promise<ExternalEditorResult> {
	const directory = mkdtempSync(join(tmpdir(), "pi-editor-"));
	const filePath = join(directory, "prompt.md");
	try {
		writeFileSync(filePath, options.content, "utf-8");
		const { executable, args } = parseEditorCommand(options.command, filePath);
		if (!executable) return { status: "failed" };
		process.stdout.write(`Launching external editor: ${options.command}\nPi will resume when the editor exits.\n`);

		// Do not use spawnSync here. On Windows, synchronous child_process calls can keep
		// Node/libuv's console input read active after the parent pauses stdin, racing
		// vim/nvim for the console input buffer until Ctrl+C cancels the pending read.
		const exitCode = await new Promise<number | null>((resolve) => {
			const child = spawnCrossPlatform(executable, args, {
				stdio: "inherit",
				shell: false,
			});
			child.on("error", () => resolve(null));
			child.on("close", (code) => resolve(code));
		});

		if (exitCode !== 0) {
			return { status: "failed" };
		}

		return { status: "complete", content: stripBom(readFileSync(filePath, "utf-8")).replace(/\n$/, "") };
	} finally {
		try {
			rmSync(directory, { recursive: true, force: true });
		} catch {
			// Cleanup is best effort.
		}
	}
}
