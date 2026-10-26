import { createServer } from "node:http";
import { join, win32 } from "node:path";
import { describe, expect, it } from "vitest";
import { moliFetch, planMoliFetch } from "../src/browser/fetch.ts";
import {
	findMoli,
	freePort,
	type LaunchedMoli,
	launchMoli,
	type MoliHost,
	moliCandidates,
	moliEndpointFrom,
	planMoliServe,
} from "../src/browser/moli.ts";
import { codeOf } from "../src/language.ts";

/** The code a rejected call carries, or undefined when it resolved. */
async function rejection(promise: Promise<unknown>): Promise<string | undefined> {
	try {
		await promise;
		return undefined;
	} catch (error) {
		return codeOf(error)?.code;
	}
}

/**
 * There is no moli where these tests run, so what is proven here is the part that decides: where a moli is
 * looked for, which command line would start one, and how an endpoint is read. Whether moli then drives a
 * page is a smoke test on a machine that has it (`SPECJEV_MOLI=/path/to/moli`, then `/browse <url>`).
 */
function host(platform: NodeJS.Platform, installed: string[], extra: Partial<MoliHost> = {}): MoliHost {
	return {
		platform,
		env: {},
		home: platform === "win32" ? "C:\\Users\\bai" : "/home/bai",
		exists: (path) => installed.includes(path),
		...extra,
	};
}

describe("finding moli", () => {
	it("looks in the Windows installer folder before PATH", () => {
		const candidates = moliCandidates(host("win32", []));
		expect(candidates[0]).toBe(win32.join("C:", "Users", "bai", "AppData", "Local", "moli", "moli.exe"));
		expect(candidates).toContain(win32.join("C:", "Users", "bai", ".local", "bin", "moli.exe"));
	});

	it("looks in the Unix install places, and then on PATH", () => {
		const candidates = moliCandidates(host("darwin", [], { env: { PATH: "/opt/tools:/usr/bin" } }));
		expect(candidates).toContain("/home/bai/.local/bin/moli");
		expect(candidates).toContain("/opt/homebrew/bin/moli");
		expect(candidates).toContain("/opt/tools/moli");
	});

	it("keeps the first copy of a path that appears twice", () => {
		const candidates = moliCandidates(host("linux", [], { env: { PATH: "/usr/local/bin:/opt/homebrew/bin" } }));
		expect(candidates.filter((path) => path === "/usr/local/bin/moli")).toHaveLength(1);
	});

	it("lets SPECJEV_MOLI name the executable", () => {
		const where = "C:\\tools\\moli.exe";
		expect(findMoli(host("win32", [where], { env: { SPECJEV_MOLI: where } }))).toBe(where);
	});

	it("finds nothing when nothing is installed", () => {
		expect(findMoli(host("linux", [], { env: { PATH: "/usr/bin" } }))).toBeUndefined();
	});
});

describe("starting moli", () => {
	it("serves with layout, because geometry is what the browser acts on", () => {
		const plan = planMoliServe({ executable: "/usr/local/bin/moli", port: 4321 });
		expect(plan.command).toBe("/usr/local/bin/moli");
		expect(plan.args).toEqual(["serve", "--host", "127.0.0.1", "--port", "4321", "--layout"]);
	});

	it("can be asked for without layout", () => {
		expect(planMoliServe({ executable: "moli", port: 1, layout: false }).args).not.toContain("--layout");
	});

	it("reads the endpoint moli announces, and the one it serves without announcing it", () => {
		expect(moliEndpointFrom({ webSocketDebuggerUrl: "ws://127.0.0.1:9/devtools/browser/x" }, 9)).toBe(
			"ws://127.0.0.1:9/devtools/browser/x",
		);
		expect(moliEndpointFrom({}, 9)).toBe("ws://127.0.0.1:9/devtools/browser/moli-browser");
	});

	it("reuses a server that already answers, without starting one", async () => {
		const server = createServer((request, response) => {
			response.writeHead(request.url === "/json/version" ? 200 : 404, { "content-type": "application/json" });
			response.end(JSON.stringify({ webSocketDebuggerUrl: "ws://127.0.0.1:1/devtools/browser/moli-browser" }));
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		const address = server.address();
		const port = typeof address === "object" && address ? address.port : 0;
		try {
			const launched: LaunchedMoli = await launchMoli({ url: `http://127.0.0.1:${port}` });
			expect(launched.endpoint).toBe("ws://127.0.0.1:1/devtools/browser/moli-browser");
			expect(launched.process).toBeUndefined();
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});

	it("says what to do when no moli is installed", async () => {
		const code = await rejection(launchMoli({ host: host("linux", [], { env: { PATH: "/usr/bin" } }) }));
		expect(code).toBe("no_moli");
	});

	it("hands out a port nothing is listening on", async () => {
		expect(await freePort()).toBeGreaterThan(0);
	});
});

describe("moli fetch", () => {
	it("asks for prose or for the semantic tree, after the page is done", () => {
		expect(planMoliFetch({ executable: "moli", url: "https://example.com", format: "markdown" }).args).toEqual([
			"fetch",
			"--dump",
			"markdown",
			"--wait-until",
			"done",
			"https://example.com",
		]);
		expect(planMoliFetch({ executable: "moli", url: "https://example.com", format: "semantic_tree" }).args).toContain(
			"semantic_tree_text",
		);
	});

	it("reports a moli that cannot be started as such", async () => {
		const code = await rejection(
			moliFetch({
				executable: join("no", "such", "moli"),
				url: "https://example.com",
				format: "markdown",
				maxChars: 100,
			}),
		);
		expect(code).toBe("moli_fetch_unavailable");
	});
});
