import { withCode } from "../language.ts";

/**
 * A minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
 * No dependencies: spec.jev ships its browser without pulling in Playwright.
 */
interface Pending {
	resolve(value: Record<string, unknown>): void;
	reject(error: Error): void;
}

export class CdpError extends Error {}

export class CdpConnection {
	private readonly socket: WebSocket;
	private readonly pending = new Map<number, Pending>();
	private nextId = 1;
	private closed = false;

	private constructor(socket: WebSocket) {
		this.socket = socket;
		socket.addEventListener("message", (event) => this.onMessage(String(event.data)));
		socket.addEventListener("close", () => this.failAll("The browser connection closed"));
		socket.addEventListener("error", () => this.failAll("The browser connection failed"));
	}

	static connect(url: string, timeoutMs = 5000): Promise<CdpConnection> {
		return new Promise((resolve, reject) => {
			const socket = new WebSocket(url);
			const timer = setTimeout(() => {
				socket.close();
				reject(withCode(new CdpError("Timed out connecting to the browser"), { code: "cdp_connect_timeout" }));
			}, timeoutMs);
			socket.addEventListener("open", () => {
				clearTimeout(timer);
				resolve(new CdpConnection(socket));
			});
			socket.addEventListener("error", () => {
				clearTimeout(timer);
				reject(withCode(new CdpError("Could not connect to the browser"), { code: "cdp_connect_failed" }));
			});
		});
	}

	private onMessage(data: string): void {
		let message: { id?: number; result?: Record<string, unknown>; error?: { message?: string } };
		try {
			message = JSON.parse(data);
		} catch {
			return;
		}
		if (message.id === undefined) return;
		const pending = this.pending.get(message.id);
		if (!pending) return;
		this.pending.delete(message.id);
		if (message.error) pending.reject(new CdpError(message.error.message ?? "CDP error"));
		else pending.resolve(message.result ?? {});
	}

	private failAll(reason: string): void {
		this.closed = true;
		for (const pending of this.pending.values()) pending.reject(new CdpError(reason));
		this.pending.clear();
	}

	/**
	 * Every call is bounded. A page can stop answering for good (a JavaScript
	 * dialog blocks all evaluation until someone dismisses it), and a browser
	 * tool that waits forever takes the whole agent with it.
	 */
	send(
		method: string,
		params: Record<string, unknown> = {},
		sessionId?: string,
		timeoutMs = 30_000,
	): Promise<Record<string, unknown>> {
		if (this.closed) return Promise.reject(new CdpError("The browser connection is closed"));
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new CdpError(`The browser did not answer ${method} within ${Math.round(timeoutMs / 1000)}s`));
			}, timeoutMs);
			this.pending.set(id, {
				resolve: (value) => {
					clearTimeout(timer);
					resolve(value);
				},
				reject: (error) => {
					clearTimeout(timer);
					reject(error);
				},
			});
			this.socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
		});
	}

	/** True once the other end is gone: a cached connection has to be replaced, not reused. */
	get isClosed(): boolean {
		return this.closed;
	}

	close(): void {
		this.closed = true;
		this.socket.close();
	}
}
