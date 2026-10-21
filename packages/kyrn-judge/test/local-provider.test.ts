import { describe, expect, it } from "vitest";
import { DecisionEngine, defineDecision } from "../src/decision.ts";
import { isJudgeError } from "../src/errors.ts";
import { Judge } from "../src/judge.ts";
import { MemoryLedger } from "../src/ledger.ts";
import { threeZone } from "../src/policy.ts";
import { LocalJudgeProvider } from "../src/providers/local.ts";
import type { Questions } from "../src/types.ts";

const questions = {
	refund: { type: "boolean", instructions: "Does the customer request a refund?" },
} satisfies Questions;

interface CapturedRequest {
	url: string;
	init: RequestInit;
}

function fakeFetch(status: number, body: unknown, captured: CapturedRequest[] = []): typeof fetch {
	return async (input, init) => {
		captured.push({ url: String(input), init: init ?? {} });
		return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
	};
}

const sidecarBody = {
	answers: { refund: { type: "boolean", probability: 0.9877 } },
	usage: { inputTokens: 47, outputTokens: 0 },
	warnings: [
		{ type: "state_truncated", questionId: "refund", message: "state has 2000 tokens, only the first 990 were read" },
		{ message: "a warning without a type is dropped" },
	],
	providerMetadata: {
		laya: {
			model: "laya:aac6fef/laya-multilingual-coreml",
			answers: { refund: { confidence: 0.9877, actProbability: 0.97 } },
		},
	},
};

describe("LocalJudgeProvider", () => {
	it("posts the gateway-shaped request to the sidecar without credentials", async () => {
		const captured: CapturedRequest[] = [];
		const provider = new LocalJudgeProvider({ fetch: fakeFetch(200, sidecarBody, captured) });

		await provider.evaluate({ state: { message: "charged twice" }, questions });

		expect(captured[0].url).toBe("http://127.0.0.1:47823/evaluate");
		expect(captured[0].init.headers).toEqual({ "Content-Type": "application/json" });
		expect(JSON.parse(String(captured[0].init.body))).toEqual({ state: { message: "charged twice" }, questions });
	});

	it("attaches the model's self-assessment to each answer and keeps well-formed warnings", async () => {
		const provider = new LocalJudgeProvider({ baseUrl: "http://127.0.0.1:9/", fetch: fakeFetch(200, sidecarBody) });

		const response = await provider.evaluate({ state: "charged twice", questions });

		expect(response.answers.refund).toEqual({
			type: "boolean",
			probability: 0.9877,
			confidence: 0.9877,
			actProbability: 0.97,
		});
		expect(response.modelId).toBe("laya:aac6fef/laya-multilingual-coreml");
		expect(response.warnings).toEqual([
			{
				type: "state_truncated",
				questionId: "refund",
				message: "state has 2000 tokens, only the first 990 were read",
			},
		]);
	});

	it("tells the user how to start the sidecar when it is down", async () => {
		const provider = new LocalJudgeProvider({
			fetch: async () => {
				throw new TypeError("fetch failed");
			},
		});

		const error = await provider.evaluate({ state: "x", questions }).catch((caught: unknown) => caught);

		expect(isJudgeError(error) && error.kind).toBe("unreachable");
		expect((error as Error).message).toContain("spec.jev judge start");
	});

	it("maps a rejected request and a sidecar crash to different error kinds", async () => {
		const rejected = new LocalJudgeProvider({
			fetch: fakeFetch(400, { error: { message: "Question has too many options for the token budget" } }),
		});
		const crashed = new LocalJudgeProvider({ fetch: fakeFetch(500, { error: { message: "Local judge failed" } }) });

		const badRequest = await rejected.evaluate({ state: "x", questions }).catch((caught: unknown) => caught);
		const server = await crashed.evaluate({ state: "x", questions }).catch((caught: unknown) => caught);

		expect(isJudgeError(badRequest) && badRequest.kind).toBe("bad_request");
		expect((badRequest as Error).message).toContain("too many options");
		expect(isJudgeError(server) && server.kind).toBe("server");
	});

	it("records truncation warnings and the model id in the ledger", async () => {
		const ledger = new MemoryLedger();
		const engine = new DecisionEngine({
			judge: new Judge({ provider: new LocalJudgeProvider({ fetch: fakeFetch(200, sidecarBody) }) }),
			ledger,
			defaultMode: "active",
		});
		const spec = defineDecision({
			id: "test.refund",
			version: 1,
			questions,
			cacheImpact: "none",
			latency: "inline",
			buildState: (message: string) => ({ message }),
			policy: (answers) => threeZone(answers.refund),
			fallback: () => "unsure" as const,
		});

		const decision = await engine.decide(spec, "charged twice");

		expect(decision.outcome).toBe("yes");
		expect(decision.warnings).toHaveLength(1);
		expect(ledger.records[0]).toMatchObject({
			providerId: "local:laya",
			modelId: "laya:aac6fef/laya-multilingual-coreml",
			warnings: [{ type: "state_truncated", questionId: "refund" }],
		});
	});
});
