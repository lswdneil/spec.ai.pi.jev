# A moli backend for the built-in browser

The built-in browser is a judge-driven loop over the Chrome DevTools Protocol: the main model states a goal, every
step is one judgment (`browser.step`), and the step is carried out over CDP. Nothing in that loop is Chrome's.
[moli](https://github.com/lexmount/moli) speaks the same protocol from a different engine, so it can take Chrome's
place without touching the decision layer.

## What spec.jev asks of a browser

Twelve commands, no Playwright, no page-side framework:

| Command | Where | Why |
| --- | --- | --- |
| `Target.createTarget`, `Target.attachToTarget` (`flatten`), `Target.closeTarget` | `browser/session.ts` | one tab per run, addressed by `sessionId` over the browser socket |
| `Page.navigate` | `browser/session.ts` | the page the run is about |
| `Runtime.evaluate` (`returnByValue`, `awaitPromise`) | `browser/session.ts` | the snapshot script reads the page and returns actions |
| `Input.dispatchMouseEvent` (`mousePressed`, `mouseReleased`, `mouseWheel`) | `browser/session.ts` | click, scroll |
| `Input.dispatchKeyEvent`, `Input.insertText` | `browser/session.ts` | typing, select-all |
| `Emulation.setDeviceMetricsOverride`, `Emulation.setFocusEmulationEnabled` | `browser/session.ts` | a fixed viewport, frames that keep running off screen |

Everything else — what is clickable, what a field means, whether the page moved — is decided by the snapshot script
(`browser/snapshot.ts`) inside the page, and by the judge.

## What moli provides

moli implements those commands (`moli-protocol/src/domains/{target,page,runtime,input,emulation}`), serves
`/json/version` and a browser-level socket at `ws://127.0.0.1:<port>/devtools/browser/moli-browser`, and is driven
through `moli serve`:

```sh
moli serve --host 127.0.0.1 --port 9222 --layout
```

`--layout` is required, not cosmetic: spec.jev resolves a target's box and hit-tests it before every action, and moli
computes layout on demand. Without it every action looks stale and the run stops.

Two differences from Chrome that the backend absorbs:

- **Discovery.** Chrome writes `DevToolsActivePort` into the profile and listens on a port of its choosing. moli
  listens where it is told and answers `/json/version`. `browser/moli.ts` picks a free port, starts the server and
  asks until it answers; `SPECJEV_MOLI_URL` reuses a server that is already running.
- **One command is optional.** `Emulation.setFocusEmulationEnabled` only keeps animation and menus alive in a tab
  that is never shown. `BrowserSession.open` now treats it as an improvement, so an engine that does not know it
  still browses.

## Configuration

| Key (`features.browser.*`) | Environment | Meaning |
| --- | --- | --- |
| `backend` | — | `auto` (default): moli when it is installed, Chrome otherwise. `chrome` and `moli` force one. |
| `moliPath` | `SPECJEV_MOLI` | the executable. Empty searches the installer folder, the usual bin folders and `PATH`. |
| `moliUrl` | `SPECJEV_MOLI_URL` | a running server, e.g. `http://127.0.0.1:9222`. |
| `fetchChars` | — | how much of a `page_fetch` reaches the model (default 12000). |

Order of use: the desktop app's browser panel (when it offers one), then moli, then Chrome.

## The cheap read: `page_fetch`

The same engine also answers a question that needs no loop:

```sh
moli fetch --dump markdown --wait-until done https://example.com
```

That is the `page_fetch` tool (`format: "markdown"` or `"semantic_tree"`) and the `/fetch` command. It opens no tab,
asks the judge nothing, and returns at most `fetchChars` characters. It follows the browser's bounds: only `http(s)`,
and never this computer or the local network unless the run was opened there.

Use `page_fetch` when you need what a page says. Use `browse` when the page has to be operated.

## Failure modes

| What happened | What the user sees |
| --- | --- |
| No moli and `backend: "auto"` | Chrome, as before; nothing is said |
| No moli and `backend: "moli"` | `no_moli`: where to install it or how to point at it |
| moli does not answer in 20 s | `moli_start_timeout`; the process is killed |
| moli exits during startup | `moli_exited_on_start` with the code |
| `SPECJEV_MOLI_URL` points at nothing | `moli_unreachable` |
| `page_fetch` without moli | a plain message pointing at `browse` |
| `page_fetch` refused by bounds | `status: blocked` with the reason; nothing is read |

## Verifying

Unit level (`packages/kyrn-judge/test/browser-moli.test.ts`): where a moli is looked for, the command line, endpoint
discovery, reuse of a running server, and the failure codes. These run without moli.

On a machine that has moli:

```sh
SPECJEV_MOLI=/path/to/moli node kyrn/bin/mu.mjs
# then: /browse https://example.com — a run that claims, judges and acts once per step
# then: /fetch https://example.com semantic_tree
```

## Not covered

- The desktop app's browser panel (`browser/embedded.ts`) keeps its own `Mu.*` protocol; moli only replaces the
  headless backend used when the app is not driving.
- Screenshots, PDFs, downloads and WebDriver are moli features spec.jev does not use.
- `Input.dispatchKeyEvent`'s `commands: ["selectAll"]` is a Chromium extension. moli has its own editing stack; if it
  ignores the field, select-all falls back to the plain Ctrl/Cmd+A key event. A run that fills a field with existing
  text is the test for it.
