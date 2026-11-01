import assert from "node:assert";
import { describe, it } from "node:test";
import { Markdown } from "../src/components/markdown.ts";
import { sanitizeTerminalText } from "../src/utils.ts";
import { defaultMarkdownTheme } from "./test-themes.ts";

describe("terminal text sanitization", () => {
	it("drops clipboard, title, cursor, APC, and non-web hyperlink sequences", () => {
		const input = [
			"before",
			"\x1b]52;c;ZXZpbA==\x07",
			"\x1b]0;owned\x07",
			"\x1b[2J",
			"\x1b_Gi=1;AAAA\x1b\\",
			"\x1b]8;;javascript:alert(1)\x07link\x1b]8;;\x07",
			"after",
		].join("");
		assert.strictEqual(sanitizeTerminalText(input), "beforelinkafter");
	});

	it("keeps SGR styling and strips raw hyperlinks", () => {
		const input = [
			"\x1b[31mred\x1b[0m ",
			"\x1b]8;;https://example.com\x1b\\web\x1b]8;;\x1b\\ ",
			"\x1b]8;;mailto:a@example.com\x07mail\x1b]8;;\x07",
		].join("");
		assert.strictEqual(sanitizeTerminalText(input), "\x1b[31mred\x1b[0m web mail");
	});

	it("applies the filter to Markdown by default", () => {
		const markdown = new Markdown("safe\x1b]52;c;ZXZpbA==\x07 text", 0, 0, defaultMarkdownTheme);
		const rendered = markdown.render(80).join("\n");
		assert.ok(rendered.includes("safe text"));
		assert.ok(!rendered.includes("\x1b]52;"));
	});
});
