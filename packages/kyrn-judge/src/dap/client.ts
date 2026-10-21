import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { connect, createServer, type Socket } from "node:net";
import { encodeMessage, MessageDecoder } from "../lsp/framing.ts";
import type { SpawnPlan } from "../lsp/servers.ts";
import { stopPlan } from "../platform.ts";

/**
 * A client of the Debug Adapter Protocol: the same Content-Length framing as
 * the language server protocol, with requests, responses and events instead
 * of JSON-RPC. The adapter speaks on its stdio, or listens on a local port it
 * is told (`{port}` in its arguments), as delve does.
 */
export interface DapEvent {
	readonly event: string;
	readonly body: Readonly<Record<string, unknown>>;
}

export type Transport = "stdio" | "tcp";

export interface DapClientOptions {
	readonly plan: SpawnPlan;
	readonly transport: Transport;
	readonly cwd: string;
	readonly env?: NodeJS.ProcessEnv;
	readonly platform?: NodeJS.Platform;
	readonly requestTimeoutMs?: number;
	/** How long a TCP adapter has to start listening. */
	readonly connectTimeoutMs?: number;
}

export class DapError extends Error {}

interface Pending {
	readonly command: string;
	readonly resolve: (body: Record<string, unknown>) => void;
	readonly reject: (error: Error) => void;
	readonly timer: NodeJS.Timeout;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A port nobody listens on right now, for an adapter that has to be told where to listen. */
export async function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			server.close(() => resolve(port));
		});
	});
}

export class DapClient {
	private readonly options: DapClientOptions;
	private child: ChildProcess | undefined;
	private socket: Socket | undefined;
	private readonly decoder = new MessageDecoder();
	private seq = 1;
	private readonly pending = new Map<number, Pending>();
	private readonly received: DapEvent[] = [];
	private readonly waiters = new Set<() => void>();
	private ended: string | undefined;
	/** What the adapter wrote to stderr, the last few kilobytes: the reason when it dies. */
	stderr = "";

	constructor(options: DapClientOptions) {
		this.options = options;
	}

	/** Events received so far. An index into it marks a point to wait from. */
	get events(): readonly DapEvent[] {
		return this.received;
	}

	get alive(): boolean {
		return this.ended === undefined;
	}

	async start(): Promise<void> {
		const { plan, transport, cwd } = this.options;
		let args = [...plan.args];
		let port = 0;
		if (transport === "tcp") {
			port = await freePort();
			args = args.map((arg) => arg.replaceAll("{port}", String(port)));
		}
		const child = spawn(plan.command, args, {
			cwd,
			env: this.options.env ?? process.env,
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
			windowsVerbatimArguments: plan.windowsVerbatimArguments,
			// Its own process group on POSIX: stopping the adapter stops the program it is debugging too.
			detached: process.platform !== "win32",
		});
		this.child = child;
		child.stderr?.on("data", (chunk: Buffer) => {
			this.stderr = `${this.stderr}${chunk.toString("utf8")}`.slice(-4000);
		});
		child.on("error", (error) => this.fail(`the debug adapter could not be started: ${error.message}`));
		child.on("exit", (code, signal) => this.fail(`the debug adapter exited (${signal ?? `code ${code}`})`));
		const readable = transport === "stdio" ? child.stdout : await this.connectTo(port);
		readable?.on("data", (chunk: Buffer) => this.receive(chunk));
		if (this.ended) throw new DapError(this.why());
	}

	private async connectTo(port: number): Promise<Socket> {
		const deadline = Date.now() + (this.options.connectTimeoutMs ?? 10_000);
		while (true) {
			if (this.ended) throw new DapError(this.why());
			try {
				const socket = await new Promise<Socket>((resolve, reject) => {
					const attempt = connect(port, "127.0.0.1", () => resolve(attempt));
					attempt.once("error", reject);
				});
				socket.on("close", () => this.fail("the debug adapter closed the connection"));
				this.socket = socket;
				return socket;
			} catch (error) {
				if (Date.now() > deadline)
					throw new DapError(`the debug adapter did not listen on port ${port}: ${String(error)}`);
				await sleep(100);
			}
		}
	}

	private why(): string {
		const said = this.stderr.trim().split("\n").slice(-3).join(" | ");
		return said ? `${this.ended}: ${said}` : (this.ended ?? "the debug adapter stopped");
	}

	private write(message: Record<string, unknown>): void {
		const data = encodeMessage(message);
		if (this.socket) this.socket.write(data);
		else this.child?.stdin?.write(data);
	}

	private receive(chunk: Buffer): void {
		let messages: unknown[];
		try {
			messages = this.decoder.push(chunk);
		} catch (error) {
			this.fail(`the debug adapter's output is not the protocol: ${String(error)}`);
			return;
		}
		for (const message of messages) {
			const { type } = message as { type?: unknown };
			if (type === "response") {
				const {
					request_seq,
					success,
					message: why,
					body,
				} = message as {
					request_seq?: number;
					success?: boolean;
					message?: string;
					body?: Record<string, unknown>;
				};
				const pending = this.pending.get(request_seq ?? -1);
				if (!pending) continue;
				this.pending.delete(request_seq as number);
				clearTimeout(pending.timer);
				if (success) pending.resolve(body ?? {});
				else pending.reject(new DapError(`${pending.command} failed: ${why ?? "no reason given"}`));
			} else if (type === "event") {
				const { event, body } = message as { event?: string; body?: Record<string, unknown> };
				if (typeof event !== "string") continue;
				this.received.push({ event, body: body ?? {} });
				for (const wake of [...this.waiters]) wake();
			} else if (type === "request") {
				// A reverse request (runInTerminal, startDebugging): spec.jev has no terminal to lend. Saying so keeps the adapter going.
				const { seq, command } = message as { seq?: number; command?: string };
				this.write({
					seq: this.seq++,
					type: "response",
					request_seq: seq,
					command,
					success: false,
					message: "not supported by this client",
				});
			}
		}
	}

	private fail(reason: string): void {
		if (this.ended) return;
		this.ended = reason;
		for (const [seq, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new DapError(`${pending.command}: ${this.why()}`));
			this.pending.delete(seq);
		}
		for (const wake of [...this.waiters]) wake();
	}

	request(command: string, args: Record<string, unknown> = {}, timeoutMs?: number): Promise<Record<string, unknown>> {
		if (this.ended) return Promise.reject(new DapError(`${command}: ${this.why()}`));
		const seq = this.seq++;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(
				() => {
					this.pending.delete(seq);
					reject(new DapError(`${command}: no answer from the debug adapter`));
				},
				timeoutMs ?? this.options.requestTimeoutMs ?? 30_000,
			);
			this.pending.set(seq, { command, resolve, reject, timer });
			this.write({ seq, type: "request", command, arguments: args });
		});
	}

	/**
	 * The first event named one of `names` at or after position `from`. Undefined when time is up, the
	 * adapter is gone, or `signal` was aborted (the user pressed Esc while the program ran).
	 */
	async waitFor(
		names: readonly string[],
		timeoutMs: number,
		from = 0,
		signal?: AbortSignal,
	): Promise<DapEvent | undefined> {
		const deadline = Date.now() + timeoutMs;
		let at = from;
		while (true) {
			for (; at < this.received.length; at++) {
				if (names.includes(this.received[at].event)) return this.received[at];
			}
			if (this.ended || signal?.aborted || Date.now() >= deadline) return undefined;
			await new Promise<void>((resolve) => {
				const wake = () => {
					this.waiters.delete(wake);
					signal?.removeEventListener("abort", wake);
					clearTimeout(timer);
					resolve();
				};
				const timer = setTimeout(wake, Math.max(1, deadline - Date.now()));
				this.waiters.add(wake);
				signal?.addEventListener("abort", wake, { once: true });
			});
		}
	}

	/** Asks the adapter to end the program and itself, then makes sure: the whole process tree goes. */
	async stop(): Promise<void> {
		if (!this.ended) await this.request("disconnect", { terminateDebuggee: true }, 2000).catch(() => undefined);
		this.killNow();
	}

	/** No goodbye, the whole process tree at once: for a process that is exiting and cannot wait. */
	killNow(): void {
		this.socket?.destroy();
		const child = this.child;
		if (child && child.pid !== undefined) {
			const running = child.exitCode === null && child.signalCode === null;
			const plan = stopPlan(this.options.platform ?? process.platform, child.pid, true);
			try {
				// taskkill walks the tree from a live process only. A POSIX group outlives its leader: an adapter that
				// exited (or crashed) can leave the program it started running in it, and only the group reaches that.
				if (plan.kind === "command") {
					if (running) spawnSync(plan.command, plan.args, { windowsHide: true });
				} else process.kill(-child.pid, plan.signal);
			} catch {
				if (running) {
					try {
						child.kill("SIGKILL");
					} catch {
						// Already gone.
					}
				}
			}
		}
		this.fail("stopped");
	}
}
