import { readFileSync } from "node:fs";
import { join } from "node:path";
import { muEnv, muHome } from "../naming.ts";
import type { CdpConnection } from "./cdp.ts";

/**
 * The desktop app has a browser of its own, in the conversation's side panel.
 * When the app is running it offers that browser to the harness, so the
 * judge-driven loop drives a page the user can watch, pause and take over,
 * instead of a headless Chrome nobody sees.
 *
 * The app does not open a debugging port for itself. Its main process attaches
 * a debugger to the browsing pages only, and serves those over a loopback
 * WebSocket whose path carries a random token. It speaks the part of the
 * DevTools protocol the loop uses (`Target.*` to open, attach and close a tab,
 * then page-level methods), and a few methods of its own under `Mu.`:
 *
 *   Mu.hello    { version, session } -> { embedded: true, version }   tells the app apart from a plain Chrome
 *   Mu.run      { state, goal, url } | { state, status, reason, code, params?, errorCode?, errorParams? }   what the run is for, and how it ended
 *   Mu.control  -> { paused, stop }              asked before every step
 *   Mu.confirm  { label, url } -> { allowed }    the app's own dialog for irreversible actions
 *   Mu.step     { ...record }                    one line for the live overlay; no answer needed
 *
 * `session` is the app's name for the conversation this harness process serves (`MU_DESKTOP_SESSION`, set by
 * the app's adapter), so the tab opens beside the right conversation. Everything about one run is sent with
 * that tab's DevTools session id, because several runs can share one connection.
 */
export const ADVERT_FILE = "desktop-browser.json";
const PROTOCOL_VERSION = 1;

export interface EmbeddedEndpoint {
	readonly url: string;
	readonly pid?: number;
}

interface Host {
	readonly env?: Readonly<Record<string, string | undefined>>;
	readonly home?: string;
	readonly readFile?: (path: string) => string;
	readonly isRunning?: (pid: number) => boolean;
}

function processRuns(pid: number): boolean {
	try {
		// Signal 0 checks for existence without touching the process, on Windows too.
		process.kill(pid, 0);
		return true;
	} catch (error) {
		// No permission to signal it still means it exists.
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

/** Only a loopback WebSocket is ever accepted: the endpoint drives a browser. */
export function loopbackSocket(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "ws:" && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
	} catch {
		return false;
	}
}

/**
 * Where the app's browser listens, if an app is running: `MU_BROWSER_ENDPOINT`,
 * or the advert the app writes into the spec.jev home (readable by the user only).
 * An advert left behind by an app that has quit is ignored.
 */
export function findEmbeddedEndpoint(host: Host = {}): EmbeddedEndpoint | undefined {
	const env = host.env ?? process.env;
	const fromEnv = muEnv("BROWSER_ENDPOINT", env);
	if (fromEnv) return loopbackSocket(fromEnv) ? { url: fromEnv } : undefined;
	try {
		const read = host.readFile ?? ((path: string) => readFileSync(path, "utf8"));
		const advert = JSON.parse(read(join(host.home ?? muHome(), ADVERT_FILE))) as { url?: unknown; pid?: unknown };
		if (typeof advert.url !== "string" || !loopbackSocket(advert.url)) return undefined;
		const pid = typeof advert.pid === "number" ? advert.pid : undefined;
		if (pid !== undefined && !(host.isRunning ?? processRuns)(pid)) return undefined;
		return { url: advert.url, pid };
	} catch {
		return undefined;
	}
}

export interface EmbeddedControl {
	readonly paused: boolean;
	readonly stop: boolean;
}

/** The app's side of a run. Every call is best effort: a closed panel must not take the run down with it. */
export class EmbeddedBrowser {
	private readonly cdp: CdpConnection;
	private readonly tab: string | undefined;

	private constructor(cdp: CdpConnection, tab?: string) {
		this.cdp = cdp;
		this.tab = tab;
	}

	/** Undefined when the other end is a plain browser, an app speaking a newer protocol, or an app with no conversation on screen. */
	static async handshake(
		cdp: CdpConnection,
		env: Readonly<Record<string, string | undefined>> = process.env,
	): Promise<EmbeddedBrowser | undefined> {
		try {
			const session = muEnv("DESKTOP_SESSION", env);
			const hello = await cdp.send(
				"Mu.hello",
				session ? { version: PROTOCOL_VERSION, session } : { version: PROTOCOL_VERSION },
				undefined,
				2000,
			);
			return hello.embedded === true && hello.version === PROTOCOL_VERSION ? new EmbeddedBrowser(cdp) : undefined;
		} catch {
			return undefined;
		}
	}

	/** The same app, speaking about one tab: pass the tab's DevTools session id. */
	forTab(sessionId: string): EmbeddedBrowser {
		return new EmbeddedBrowser(this.cdp, sessionId);
	}

	/** What the run is for, and later how it ended, so the app can say more than "finished". */
	run(report: Readonly<Record<string, unknown>>): void {
		this.cdp.send("Mu.run", { ...report }, this.tab, 2000).catch(() => undefined);
	}

	async control(): Promise<EmbeddedControl> {
		try {
			const state = await this.cdp.send("Mu.control", {}, this.tab, 2000);
			return { paused: state.paused === true, stop: state.stop === true };
		} catch {
			return { paused: false, stop: false };
		}
	}

	/** The person at the app decides. The app says no by itself after 120 s; waiting a little longer lets that answer arrive. */
	async confirm(label: string, url: string): Promise<boolean> {
		try {
			const answer = await this.cdp.send("Mu.confirm", { label, url }, this.tab, 125_000);
			return answer.allowed === true;
		} catch {
			return false;
		}
	}

	step(record: Readonly<Record<string, unknown>>): void {
		this.cdp.send("Mu.step", { ...record }, this.tab, 2000).catch(() => undefined);
	}

	/**
	 * Waits while the user has the run paused. Resolves to false when they stopped
	 * it, or when the run was aborted meanwhile.
	 */
	async mayContinue(signal?: AbortSignal, pollMs = 400): Promise<boolean> {
		while (true) {
			if (signal?.aborted) return false;
			const state = await this.control();
			if (state.stop) return false;
			if (!state.paused) return true;
			await new Promise((resolve) => setTimeout(resolve, pollMs));
		}
	}
}
