/**
 * spec.jev's judge-routed sub-agents alone, for a stock pi:
 *
 *   pi -e packages/kyrn-judge/src/extension/kyrn-swarm.ts
 *
 * Registers the `delegate` tool, `/agents` and `/kyrn`, nothing else. Roles
 * use the agent file format of pi's subagent example, so existing files in
 * `<agent dir>/agents` work unchanged. Do not load this together with
 * kyrn-judge.ts, which already includes it.
 */
import { createKyrnJudgeExtension } from "./kyrn-judge.ts";

export default createKyrnJudgeExtension({ only: ["swarm"] });
