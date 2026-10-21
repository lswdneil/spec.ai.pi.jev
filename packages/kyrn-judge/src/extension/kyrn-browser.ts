/**
 * The spec.jev browser alone, for a stock pi:
 *
 *   pi -e packages/kyrn-judge/src/extension/kyrn-browser.ts
 *
 * Registers the `browse` tool and `/kyrn`, nothing else. The judge that drives
 * it comes from `<agent dir>/kyrn.json` or KYRN_JUDGE, as in the full
 * extension; it needs one that can relate a goal to a page (Jev, or
 * `llm:<provider>/<model>`). Do not load this together with kyrn-judge.ts,
 * which already includes it.
 */
import { createKyrnJudgeExtension } from "./kyrn-judge.ts";

export default createKyrnJudgeExtension({ only: ["browser"] });
