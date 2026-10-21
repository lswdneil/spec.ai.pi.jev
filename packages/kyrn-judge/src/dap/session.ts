import { type DapClient, DapError } from "./client.ts";

/**
 * One debugging run: launch to the first stop, step, look at variables, end.
 * The protocol has more (watchpoints, memory, threads by the dozen); a model
 * that asks "why is this value wrong" or "where does it hang" needs the stop,
 * the frames, the locals, and an expression evaluated in one of them.
 */
export interface Breakpoint {
	readonly file: string;
	readonly line: number;
	readonly condition?: string;
}

export interface BreakpointState {
	readonly file: string;
	readonly line: number;
	readonly verified: boolean;
	readonly message?: string;
}

export interface Frame {
	readonly id: number;
	readonly name: string;
	readonly file?: string;
	readonly line: number;
}

export interface Variable {
	readonly name: string;
	readonly value: string;
	readonly type?: string;
	/** Above zero: it has members, and `variables` of this reference lists them. */
	readonly reference: number;
}

export type Where =
	| {
			readonly state: "stopped";
			readonly reason: string;
			readonly description?: string;
			/** What stopped it, when it was an exception: its type and message. */
			readonly exception?: string;
			readonly threadId: number;
			readonly frames: readonly Frame[];
			readonly scope?: string;
			readonly locals: readonly Variable[];
	  }
	| { readonly state: "ended"; readonly exitCode?: number }
	/** Neither stopped nor ended in the time given: a long computation, a loop, or a wait for input. */
	| { readonly state: "running" };

export interface SessionLimits {
	readonly maxFrames: number;
	readonly maxVariables: number;
	/** How long a launch or a step waits for the program to stop or end. */
	readonly stopTimeoutMs: number;
	readonly outputChars: number;
	readonly valueChars?: number;
}

export type StepAction = "continue" | "next" | "stepIn" | "stepOut" | "pause" | "wait";

const record = (value: unknown): Record<string, unknown> =>
	typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.map(record) : []);

export class DebugSession {
	private readonly client: DapClient;
	private readonly limits: SessionLimits;
	private capabilities: Record<string, unknown> = {};
	private state: Where["state"] = "running";
	private threadId = 0;
	private frames: readonly Frame[] = [];
	private outputFrom = 0;

	constructor(client: DapClient, limits: SessionLimits) {
		this.client = client;
		this.limits = limits;
	}

	get ended(): boolean {
		return this.state === "ended" || !this.client.alive;
	}

	get current(): Where["state"] {
		return this.ended ? "ended" : this.state;
	}

	/**
	 * initialize, then launch; breakpoints go in when the adapter says `initialized`, and the program
	 * runs after `configurationDone`. Adapters differ in when they answer `launch` (debugpy only after
	 * configurationDone, lldb-dap before `initialized`), so it is sent without waiting for its answer.
	 */
	async launch(
		adapterId: string,
		launchArguments: Record<string, unknown>,
		breakpoints: readonly Breakpoint[],
		signal?: AbortSignal,
	): Promise<{ where: Where; breakpoints: BreakpointState[] }> {
		const from = this.client.events.length;
		this.capabilities = await this.client.request("initialize", {
			clientID: "mu",
			clientName: "mu",
			adapterID: adapterId,
			locale: "en-US",
			linesStartAt1: true,
			columnsStartAt1: true,
			pathFormat: "path",
			supportsVariableType: true,
			supportsRunInTerminalRequest: false,
		});
		let launchError: Error | undefined;
		const launched = this.client
			.request("launch", launchArguments, this.limits.stopTimeoutMs + 30_000)
			.then(() => true)
			.catch((error: Error) => {
				launchError = error;
				return false;
			});
		const first = await Promise.race([this.client.waitFor(["initialized"], 30_000, from), launched]);
		if (launchError) throw launchError;
		if (first === undefined || (first === true && !(await this.client.waitFor(["initialized"], 10_000, from)))) {
			throw new DapError(
				this.client.alive
					? "the debug adapter never said it was ready (no initialized event)"
					: "the debug adapter stopped while starting",
			);
		}
		const states = await this.setBreakpoints(breakpoints);
		// Stop where an exception nobody catches is thrown, when the adapter has such a filter on by default
		// (debugpy's "uncaught"): the crash site with its locals is what a debugging run is usually for.
		const filters = list(this.capabilities.exceptionBreakpointFilters)
			.filter((filter) => filter.default === true && typeof filter.filter === "string")
			.map((filter) => filter.filter as string);
		if (filters.length > 0) {
			await this.client.request("setExceptionBreakpoints", { filters }).catch(() => undefined);
		}
		await this.client.request("configurationDone", {}).catch((error: Error) => {
			// An adapter that does not know the request has nothing to configure.
			if (this.capabilities.supportsConfigurationDoneRequest === true) throw error;
		});
		await launched;
		if (launchError) throw launchError;
		return { where: await this.waitStop(from, signal), breakpoints: states };
	}

	private async setBreakpoints(breakpoints: readonly Breakpoint[]): Promise<BreakpointState[]> {
		const byFile = new Map<string, Breakpoint[]>();
		for (const point of breakpoints) byFile.set(point.file, [...(byFile.get(point.file) ?? []), point]);
		const states: BreakpointState[] = [];
		for (const [file, points] of byFile) {
			let listed: Record<string, unknown>[] = [];
			let failed: string | undefined;
			try {
				const answer = await this.client.request("setBreakpoints", {
					source: { path: file },
					breakpoints: points.map((point) =>
						point.condition ? { line: point.line, condition: point.condition } : { line: point.line },
					),
					lines: points.map((point) => point.line),
				});
				listed = list(answer.breakpoints);
			} catch (error) {
				failed = error instanceof Error ? error.message : String(error);
			}
			points.forEach((point, index) => {
				const got = listed[index] ?? {};
				states.push({
					file,
					line: typeof got.line === "number" ? got.line : point.line,
					verified: got.verified === true,
					message: typeof got.message === "string" ? got.message : failed,
				});
			});
		}
		return states;
	}

	private async waitStop(from: number, signal?: AbortSignal): Promise<Where> {
		const event = await this.client.waitFor(
			["stopped", "terminated", "exited"],
			this.limits.stopTimeoutMs,
			from,
			signal,
		);
		if (!event) {
			if (!this.client.alive) {
				this.state = "ended";
				throw new DapError("the debug adapter stopped before the program did");
			}
			this.state = "running";
			return { state: "running" };
		}
		if (event.event !== "stopped") {
			this.state = "ended";
			const exited = event.event === "exited" ? event : await this.client.waitFor(["exited"], 300, from);
			const code = exited?.body.exitCode;
			return { state: "ended", exitCode: typeof code === "number" ? code : undefined };
		}
		this.state = "stopped";
		const body = event.body;
		this.threadId = typeof body.threadId === "number" ? body.threadId : await this.firstThread();
		const trace = await this.client.request("stackTrace", {
			threadId: this.threadId,
			startFrame: 0,
			levels: this.limits.maxFrames,
		});
		this.frames = list(trace.stackFrames)
			.slice(0, this.limits.maxFrames)
			.map((frame) => {
				const source = record(frame.source);
				return {
					id: Number(frame.id),
					name: String(frame.name ?? "?"),
					file:
						typeof source.path === "string"
							? source.path
							: typeof source.name === "string"
								? source.name
								: undefined,
					line: Number(frame.line ?? 0),
				};
			});
		const reason = String(body.reason ?? "stopped");
		const exception = reason === "exception" ? await this.exception(body) : undefined;
		const { scope, variables } = this.frames.length > 0 ? await this.locals(0) : { scope: undefined, variables: [] };
		return {
			state: "stopped",
			reason,
			description: typeof body.description === "string" ? body.description : undefined,
			exception,
			threadId: this.threadId,
			frames: this.frames,
			scope,
			locals: variables,
		};
	}

	private async exception(body: Readonly<Record<string, unknown>>): Promise<string | undefined> {
		const said = typeof body.text === "string" ? body.text : undefined;
		if (this.capabilities.supportsExceptionInfoRequest !== true) return said;
		const info = await this.client.request("exceptionInfo", { threadId: this.threadId }).catch(() => undefined);
		if (!info) return said;
		const id = typeof info.exceptionId === "string" ? info.exceptionId : "";
		const description = typeof info.description === "string" ? info.description : "";
		return [id, description].filter(Boolean).join(": ") || said;
	}

	private async firstThread(): Promise<number> {
		const answer = await this.client.request("threads").catch(() => ({ threads: [] }));
		const first = list(answer.threads)[0];
		return typeof first?.id === "number" ? first.id : 1;
	}

	private clip(value: unknown): string {
		const text = String(value ?? "");
		const limit = this.limits.valueChars ?? 200;
		return text.length > limit ? `${text.slice(0, limit)}...` : text;
	}

	private frame(index: number): Frame {
		if (this.current !== "stopped") throw new DapError(`the program is ${this.current}, not stopped`);
		const frame = this.frames[index];
		if (!frame) throw new DapError(`there is no frame ${index}; frames 0 to ${this.frames.length - 1} are shown`);
		return frame;
	}

	/** The variables of a frame's first cheap scope (its locals, in every adapter spec.jev knows). */
	async locals(index: number): Promise<{ scope?: string; variables: Variable[] }> {
		const frame = this.frame(index);
		const answer = await this.client
			.request("scopes", { frameId: frame.id })
			.catch((): Record<string, unknown> => ({}));
		const scopes = list(answer.scopes);
		const chosen = scopes.find((scope) => scope.expensive !== true) ?? scopes[0];
		if (!chosen || typeof chosen.variablesReference !== "number") return { variables: [] };
		return { scope: String(chosen.name ?? "Locals"), variables: await this.variables(chosen.variablesReference) };
	}

	async variables(reference: number): Promise<Variable[]> {
		if (this.current !== "stopped") throw new DapError(`the program is ${this.current}, not stopped`);
		const answer = await this.client.request("variables", { variablesReference: reference });
		return list(answer.variables)
			.slice(0, this.limits.maxVariables)
			.map((variable) => ({
				name: String(variable.name ?? "?"),
				value: this.clip(variable.value),
				type: typeof variable.type === "string" && variable.type ? variable.type : undefined,
				reference: typeof variable.variablesReference === "number" ? variable.variablesReference : 0,
			}));
	}

	/** An expression evaluated in a frame of the current stop, 0 being the innermost. */
	async evaluate(expression: string, index = 0): Promise<{ value: string; type?: string; reference: number }> {
		const frame = this.frame(index);
		const answer = await this.client.request("evaluate", { expression, frameId: frame.id, context: "watch" });
		return {
			value: this.clip(answer.result),
			type: typeof answer.type === "string" && answer.type ? answer.type : undefined,
			reference: typeof answer.variablesReference === "number" ? answer.variablesReference : 0,
		};
	}

	/** Moves on: a step or continue from a stop, a pause of a running program, or more waiting for it. */
	async step(action: StepAction, signal?: AbortSignal): Promise<Where> {
		if (this.ended) return { state: "ended" };
		const from = this.client.events.length;
		if (action === "wait") {
			if (this.state !== "running") throw new DapError(`the program is ${this.state}: nothing to wait for`);
			return this.waitStop(from, signal);
		}
		if (action === "pause") {
			if (this.state !== "running") throw new DapError(`the program is already ${this.state}`);
			await this.client.request("pause", { threadId: this.threadId || (await this.firstThread()) });
			return this.waitStop(from, signal);
		}
		if (this.state !== "stopped") throw new DapError(`the program is ${this.state}: pause it or wait first`);
		this.state = "running";
		try {
			await this.client.request(action, { threadId: this.threadId });
		} catch (error) {
			if (this.client.alive) this.state = "stopped";
			throw error;
		}
		return this.waitStop(from, signal);
	}

	/** What the program printed since the last time this was asked; the tail when it is too much. */
	output(): string {
		let text = "";
		const events = this.client.events;
		for (; this.outputFrom < events.length; this.outputFrom++) {
			const event = events[this.outputFrom];
			if (event.event !== "output" || event.body.category === "telemetry") continue;
			text += String(event.body.output ?? "");
		}
		const limit = this.limits.outputChars;
		return text.length > limit ? `[... ${text.length - limit} characters]\n${text.slice(-limit)}` : text;
	}

	async end(): Promise<void> {
		this.state = "ended";
		await this.client.stop();
	}
}
