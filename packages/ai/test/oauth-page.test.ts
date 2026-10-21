import { describe, expect, it } from "vitest";
import { oauthErrorHtml, oauthSuccessHtml } from "../src/utils/oauth-page.ts";

// The mark's own bytes, as the desktop's icon build draws it: a PNG the page carries inside an SVG.
const MARK_START = "data:image/png;base64,iVBORw0KGgo";
// The first point of pi's pixel logo, which the page no longer shows.
const PI_LOGO_START = "M165.29 165.29";

describe("sign-in result page", () => {
	it("shows spec.jev's mark and says the sign-in worked", () => {
		const html = oauthSuccessHtml("OpenAI authentication completed. You can close this window.");
		expect(html).toContain("<title>Signed in · spec.jev</title>");
		expect(html).toContain("<h1>Signed in</h1>");
		expect(html).toContain("OpenAI authentication completed. You can close this window.");
		expect(html).toContain(MARK_START);
		expect(html).not.toContain(PI_LOGO_START);
	});

	it("uses the mark as the tab icon", () => {
		const html = oauthSuccessHtml("done");
		expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,[^"]+" \/>/);
		expect(html).toContain(encodeURIComponent(MARK_START));
	});

	it("follows the browser's light or dark mode with white or black only", () => {
		const html = oauthSuccessHtml("done");
		expect(html).toContain('<meta name="color-scheme" content="light dark" />');
		expect(html).toContain("--page-bg: #ffffff;");
		expect(html).toContain("--page-bg: #000000;");
	});

	it("names a failed sign-in, escapes what the provider said, and still shows the mark", () => {
		const html = oauthErrorHtml("Anthropic authentication did not complete.", 'Error: <script>alert("x")</script>');
		expect(html).toContain("<h1>Sign-in did not complete</h1>");
		expect(html).toContain("Anthropic authentication did not complete.");
		expect(html).toContain('<div class="details">Error: &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</div>');
		expect(html).not.toContain("<script>");
		expect(html).toContain(MARK_START);
	});

	it("leaves the details block out when there are none", () => {
		expect(oauthErrorHtml("State mismatch.")).not.toContain('class="details"');
	});
});
