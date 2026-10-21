import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import { codedError } from "../language.ts";
import { muEnv } from "../naming.ts";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Everything the search for moli depends on, passed in. There is no Windows machine and no WSL where spec.jev is
 * developed, so which paths are looked at is decided by a function that can be called with those facts on a Mac.
 */
export interface MoliHost {
	readonly platform: NodeJS.Platform;
	readonly env: Env;
	readonly home: string;
	exists(path: string): boolean;
}

/** Installer places, best first. `~` is expanded against the host's home. */
const UNIX: readonly string[] = [
	"~/.local/bin/moli",
	"/usr/local/bin/moli",
	"/opt/homebrew/bin/moli",
	"~/.cargo/bin/moli",
	"/usr/bin/moli",
];

/** `%LOCALAPPDATA%\moli` is where the Windows installer puts it; the rest are hand-built or cargo installs. */
const WINDOWS: readonly string[] = [
	"%LOCALAPPDATA%\\moli\\moli.exe",
	"%LOCALAPPDATA%\\Programs\\moli\\moli.exe",
	"%USERPROFILE%\\.local\\bin\\moli.exe",
	"%USERPROFILE%\\.cargo\\bin\\moli.exe",
];

function expand(template: string, host: MoliHost): string {
	const local = host.env.LOCALAPPDATA ?? (host.platform === "win32" ? win32.join(host.home, "AppData", "Local") : "");
	const expanded = template
		.replace(/^~/, host.home)
		.replace(/%LOCALAPPDATA%/gi, local)
		.replace(/%USERPROFILE%/gi, host.home);
	return host.platform === "win32" ? win32.normalize(expanded) : expanded;
}

/** Every place a moli executable is looked for on this host, best first. */
export function moliCandidates(host: MoliHost): string[] {
	const template = host.platform === "win32" ? WINDOWS : UNIX;
	const joined = (dir: string): string =>
		host.platform === "win32" ? win32.join(dir, "moli.exe") : posix.join(dir, "moli");
	const onPath = (host.env.PATH ?? "")
		.split(host.platform === "win32" ? ";" : ":")
		.filter(Boolean)
		.map(joined);
	const paths = [...template.map((entry) => expand(entry, host)), ...onPath];
	// Windows does not care how a path's letters are capitalised; the check against the file system does.
	const seen = new Set<string>();
	return paths.filter((path) => {
		const key = host.platform === "win32" ? path.toLowerCase() : path;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/** The moli executable spec.jev would run: SPECJEV_MOLI (then MU_MOLI, KYRN_MOLI) wins, then the install places and PATH. */
export function findMoli(host: MoliHost = thisMoliHost()): string | undefined {
	const chosen = muEnv("MOLI", host.env);
	if (chosen && host.exists(chosen)) return chosen;
	return moliCandidates(host).find((candidate) => host.exists(candidate));
}

export function thisMoliHost(env: Env = process.env): MoliHost {
	return { platform: process.platform, env, home: homedir(), exists: existsSync };
}

export interface MoliServePlan {
	readonly command: string;
	readonly args: string[];
}

/**
 * The command line for moli's automation server. `--layout` is not optional in practice: spec.jev resolves a
 * target's geometry and hit-tests it before every action, and without layout moli reports no boxes, so every
 * action would look stale. The port is chosen by spec.jev; moli's default is a constant, which would collide when
 * two sessions browse at once.
 */
export function planMoliServe(input: {
	executable: string;
	port: number;
	layout?: boolean;
	host?: string;
}): MoliServePlan {
	const args = ["serve", "--host", input.host ?? "127.0.0.1", "--port", String(input.port)];
	if (input.layout !== false) args.push("--layout");
	return { command: input.executable, args };
}

/** A port nothing is listening on right now. */
export function freePort(host = "127.0.0.1"): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, host, () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			server.close(() => (port ? resolve(port) : reject(new Error("no free port"))));
		});
	});
}

/** The endpoint moli announces, or the one it serves when its discovery page leaves the field out. */
export function moliEndpointFrom(version: unknown, port: number): string | undefined {
	const url = (version as { webSocketDebuggerUrl?: unknown } | null)?.webSocketDebuggerUrl;
	return typeof url === "string" && url.startsWith("ws")
		? url
		: `ws://127.0.0.1:${port}/devtools/browser/moli-browser`;
}

/** `/json/version`, the page Chrome and moli both serve for whoever starts them. */
async function probe(url: string, timeoutMs = 800): Promise<unknown | undefined> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
		return response.ok ? await response.json() : undefined;
	} catch {
		return undefined;
	}
}

export interface MoliLaunchOptions {
	/** SPECJEV_MOLI: an executable to use instead of the search. */
	readonly executable?: string;
	/** SPECJEV_MOLI_URL: an automation server that is already running, e.g. http://127.0.0.1:9222. */
	readonly url?: string;
	readonly port?: number;
	readonly layout?: boolean;
	readonly host?: MoliHost;
	/** How long the server may take to answer, in milliseconds: 20 s. Tests shorten it. */
	readonly startupMs?: number;
}

export interface LaunchedMoli {
	/** WebSocket URL of the browser-level DevTools endpoint. */
	readonly endpoint: string;
	readonly port: number;
	/** Undefined when a server that was already running was reused. */
	readonly process?: ChildProcess;
}

function exitOf(child: ChildProcess, ms: number): Promise<void> {
	if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		child.once("exit", () => {
			clearTimeout(timer);
			resolve();
		});
	});
}

/**
 * Starts moli's automation server, or reuses the one at `url`. The window between `listen` and the server
 * answering `/json/version` is moli's startup, which includes a V8 isolate: a fixed wait would be either
 * slower than necessary or flaky, so the port is asked until it answers.
 */
export async function launchMoli(options: MoliLaunchOptions = {}): Promise<LaunchedMoli> {
	const host = options.host ?? thisMoliHost();
	const announced = options.url ?? muEnv("MOLI_URL", host.env);
	if (announced) {
		if (announced.startsWith("ws")) {
			const port = Number(/:(?<port>\d+)\//.exec(announced)?.groups?.port ?? 0);
			return { endpoint: announced, port };
		}
		const base = announced.replace(/\/+$/, "");
		const version = await probe(`${base}/json/version`);
		const port = Number(/:(?<port>\d+)$/.exec(base)?.groups?.port ?? 0);
		if (!version)
			throw codedError(`Nothing answered at ${base}. Start moli serve there, or unset SPECJEV_MOLI_URL.`, {
				code: "moli_unreachable",
				params: { url: base },
			});
		const endpoint = moliEndpointFrom(version, port);
		if (!endpoint)
			throw codedError(`${base} does not announce a DevTools endpoint.`, {
				code: "moli_no_endpoint",
				params: { url: base },
			});
		return { endpoint, port };
	}

	const executable = options.executable ?? findMoli(host);
	if (!executable)
		throw codedError(
			"No moli found. Install it (https://github.com/lexmount/moli), or set SPECJEV_MOLI to its executable.",
			{ code: "no_moli", params: { platform: host.platform } },
		);

	const port = options.port ?? (await freePort());
	const plan = planMoliServe({ executable, port, layout: options.layout });
	const child = spawn(plan.command, plan.args, { stdio: "ignore", windowsHide: true, detached: false });
	let failure: Error | undefined;
	child.on("error", (error) => {
		failure = error;
	});

	const deadline = Date.now() + (options.startupMs ?? 20_000);
	while (Date.now() < deadline) {
		if (failure)
			throw codedError(`${plan.command} could not be started: ${failure.message}`, {
				code: "moli_spawn_failed",
				params: { command: plan.command },
			});
		const version = await probe(`http://127.0.0.1:${port}/json/version`, 500);
		if (version) {
			const endpoint = moliEndpointFrom(version, port);
			if (endpoint) return { endpoint, port, process: child };
		}
		if (child.exitCode !== null)
			throw codedError(`moli exited during startup (code ${child.exitCode})`, {
				code: "moli_exited_on_start",
				params: { exitCode: child.exitCode },
			});
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	child.kill();
	await exitOf(child, 5_000);
	throw codedError(`moli did not answer on port ${port} in time`, { code: "moli_start_timeout", params: { port } });
}
