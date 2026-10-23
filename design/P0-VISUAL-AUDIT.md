# P0 visual audit - Dense shell

Scope: desktop DEV window at 1600x1000, plus 780x900 and 480x900 narrow-window checks; dark and light; expanded and collapsed rail; welcome; command palette; dropdowns; settings rail sample.

## Icon decision

- 16px was evaluated: clean in expanded rows, but slightly underweight in the collapsed 48px rail.
- Final value: **18px** (`--sv-icon-sider: var(--sv-icon-lg)`).
- Expanded and collapsed use the same `sv-icon-sider` class; no per-state size branch.
- Logo remains 20px, so taskbar icons never exceed it.
- The shared scale (`--sv-icon-xs/sm/md/lg/xl`) is enforced by `tests/unit/renderer/iconTokens.test.ts`.

## Passed

- Dark and light surfaces, borders and text contrast.
- Theme switch at titlebar top-left with working Sun/Moon state.
- Collapsed expand control below the logo on the rail icon column; tooltip to the right.
- Command palette hover bar and mouse-following selection.
- Hover dropdown/select/tree rows keep the leading accent.
- Jev pink status dot and violet tags/focus; ordinary UI remains sage.
- Settings rail and main shell spacing sampled in both appearances.

## Fixed during P0

- Hero display token is responsive again: `clamp(26px, 3.4vw, 34px)`, so the welcome title shrinks instead of overflowing.
- The guide column no longer forces a 360px minimum inside a narrower content area; it uses the available width.

## Residual / next

- Electron desktop never switches to the phone overlay, however narrow the window. At very narrow desktop widths the action row can still clip its model chip; true 390px mobile validation needs the phone shell or a real device/browser.
- Content-area icon literals (SendBox, Markdown, conversation panels, etc.) are still outside the shell guard; migrate them in P1.
