/**
 * The page a sign-in ends on in the browser: spec.jev's mark, one line saying whether it worked, and the
 * provider's own sentence. Every OAuth flow here (ChatGPT, Claude, OpenRouter, Radius) and spec.jev's own
 * Google sign-ins render it, so a person sees the same page whichever account they connect.
 */

// The mark as the desktop draws it, built by desktop/scripts/kyrn/icon/build-icon.py: the brand logo as a
// PNG it carries, so the page needs no second request and no font.
const MU_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" fill="none" aria-hidden="true"><image width="128" height="128" href="data:image/png;base64,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"/></svg>`;

// The same mark as the tab icon, so the browser tab shows spec.jev rather than a blank page icon.
const MU_FAVICON = `data:image/svg+xml,${encodeURIComponent(MU_MARK_SVG)}`;

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function renderPage(options: { heading: string; message: string; details?: string }): string {
	const title = escapeHtml(`${options.heading} · spec.jev`);
	const heading = escapeHtml(options.heading);
	const message = escapeHtml(options.message);
	const details = options.details ? escapeHtml(options.details) : undefined;

	// White in light mode, black in dark mode; colour only on the mark itself.
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="${MU_FAVICON}" />
  <style>
    :root {
      color-scheme: light dark;
      --text: #111111;
      --text-dim: #6b6b70;
      --page-bg: #ffffff;
      --font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --text: #f4f4f5;
        --text-dim: #9a9aa1;
        --page-bg: #000000;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: var(--page-bg);
      color: var(--text);
      font-family: var(--font-sans);
      text-align: center;
    }
    main {
      width: 100%;
      max-width: 520px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .mark {
      width: 72px;
      height: 72px;
      display: block;
      margin-bottom: 28px;
    }
    .mark svg { display: block; width: 100%; height: 100%; }
    h1 {
      margin: 0 0 10px;
      font-size: 26px;
      line-height: 1.2;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    p {
      margin: 0;
      line-height: 1.7;
      color: var(--text-dim);
      font-size: 15px;
    }
    .details {
      margin-top: 16px;
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--text-dim);
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main>
    <div class="mark">${MU_MARK_SVG}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    ${details ? `<div class="details">${details}</div>` : ""}
  </main>
</body>
</html>`;
}

export function oauthSuccessHtml(message: string): string {
	return renderPage({ heading: "Signed in", message });
}

export function oauthErrorHtml(message: string, details?: string): string {
	return renderPage({ heading: "Sign-in did not complete", message, details });
}
