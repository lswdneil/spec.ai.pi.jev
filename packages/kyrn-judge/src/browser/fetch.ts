import { type ChildProcess, spawn } from "node:child_process";
import { codedError } from "../language.ts";

/** What moli writes out: prose for a model to read, or the page's structure with no prose around it. */
export type FetchFormat = "markdown" | "semantic_tree";

/** The `--dump` name each format asks for. moli's own spelling is kept so an update to it stays visible here. */
const DUMP: Readonly<Record<FetchFormat, string>> = {
	markdown: "markdown",
	semantic_tree: "semantic_tree_text",
};

export interface MoliFetchPlan {
	readonly command: string;
	readonly args: string[];
}

/**
 * The command line for one moli fetch. `--wait-until done` makes moli wait for the page to finish loading
 * before dumping it; the default (`load`) returns before a client-rendered page has any content.
 */
export function planMoliFetch(input: { executable: string; url: string; format: FetchFormat }): MoliFetchPlan {
	return {
		command: input.executable,
		args: ["fetch", "--dump", DUMP[input.format], "--wait-until", "done", input.url],
	};
}

export interface MoliFetchOptions {
	readonly executable: string;
	readonly url: string;
	readonly format: FetchFormat;
	/** How much of the result goes back to the model. The rest is dropped, with a note that it was. */
	readonly maxChars: number;
	readonly timeoutMs?: number;
	readonly signal?: AbortSignal;
}

/** Windows command lines are limited; stderr is only for the message that ends a failure. */
const STDERR_CHARS = 2_000;
/** A page can be megabytes. Nothing past this is kept: it would only be cut later. */
const STDOUT_CHARS = 2_000_000;

export interface MoliFetchResult {
	readonly text: string;
	readonly format: FetchFormat;
	readonly truncated: boolean;
}

/**
 * One page, fetched and dumped by moli's own headless engine: no tab, no DevTools session, no judge call.
 * It is the cheap read of the built-in browser, and it follows the same bounds: it only opens http(s).
 */
export function moliFetch(options: MoliFetchOptions): Promise<MoliFetchResult> {
	const plan = planMoliFetch({ executable: options.executable, url: options.url, format: options.format });
	return new Promise((resolve, reject) => {
		const child: ChildProcess = spawn(plan.command, plan.args, {
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
			detached: false,
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const finish = (error: Error | undefined, text?: string): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			options.signal?.removeEventListener("abort", stop);
			if (error) reject(error);
			else {
				const truncated = text !== undefined && text.length > options.maxChars;
				resolve({
					text: truncated
						? `${text.slice(0, options.maxChars)}\n\n[cut at ${options.maxChars} characters]`
						: (text ?? ""),
					format: options.format,
					truncated,
				});
			}
		};
		const stop = (): void => {
			child.kill();
			finish(codedError("The fetch was stopped.", { code: "moli_fetch_stopped" }));
		};
		const timer = setTimeout(stop, options.timeoutMs ?? 60_000);
		if (options.signal?.aborted) {
			stop();
			return;
		}
		options.signal?.addEventListener("abort", stop, { once: true });

		child.stdout?.on("data", (chunk: Buffer) => {
			if (stdout.length < STDOUT_CHARS) stdout += chunk.toString("utf8");
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			if (stderr.length < STDERR_CHARS) stderr += chunk.toString("utf8");
		});
		child.on("error", (error) => {
			finish(
				codedError(`moli could not be started: ${error.message}`, {
					code: "moli_fetch_unavailable",
					params: { command: plan.command },
				}),
			);
		});
		child.on("close", (code) => {
			if (settled) return;
			if (code !== 0) {
				const detail = stderr.trim().split("\n").slice(-3).join("\n");
				finish(
					codedError(`moli fetch failed (exit ${code})${detail ? `: ${detail}` : ""}`, {
						code: "moli_fetch_failed",
						params: { exitCode: code ?? -1 },
					}),
				);
				return;
			}
			finish(undefined, stdout);
		});
	});
}
