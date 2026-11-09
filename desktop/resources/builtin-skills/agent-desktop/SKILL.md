---
name: agent-desktop
description: >
  Operate desktop applications on Windows, macOS and Linux through native accessibility trees, using the
  agent-desktop CLI that ships with spec.jev. Use when the person asks to see or act on a desktop GUI: click a
  button, fill a form, read UI state, navigate menus, toggle a checkbox, scroll, drag, type text, press
  shortcuts, take a screenshot, manage windows, use the clipboard, launch or close an app, or read
  notifications. Triggers on: "click button", "fill form", "open this app", "read the window", "computer use",
  "operate the desktop", "accessibility tree", "snapshot the app", "type into the field", "navigate the menu",
  "take a screenshot", "desktop automation", "agent-desktop", or any desktop GUI task.
license: Apache-2.0 (see LICENSE); upstream vercel-labs/agent-desktop
compatibility: Bundled with spec.jev. Windows 10 1809+ (UI Automation), macOS 13+ (AX), Ubuntu 24.04+ (AT-SPI), in the signed-in user's interactive desktop session.
---

# agent-desktop

agent-desktop reads and operates desktop apps through the operating system's accessibility tree, without
screenshots or pixel matching. Every command prints one JSON envelope (`ok`, `data` or `error`). It is a tool,
not an agent: the observe, act and verify loop runs in you.

The binary ships inside spec.jev. It is already on `PATH`, so `agent-desktop` works in an agent shell as-is.
When it is not on `PATH`, use the absolute path the app records:

```powershell
& $env:SPECJEV_AGENT_DESKTOP status
```

## First run

1. Run `agent-desktop status`. It reports the platform, permissions and `supported_surfaces`.
2. Run `agent-desktop skills get platform`. It prints the guide for the OS the binary runs on; follow it. This
   skill carries the cross-platform loop, the binary carries the version-matched platform detail.
3. For flags and syntax, run `agent-desktop <command> --help`. This skill does not repeat flag lists.

## Shell syntax

Examples use a POSIX shell (bash), which is what the agent's bash tool runs on Windows too. In PowerShell quote
every ref (`'@s8f3k2p9:e1'`), because a bare `@token` is the splatting operator; use `$env:NAME = 'value'` instead
of `export`, and `| ConvertFrom-Json` instead of `jq`. cmd.exe and bash need no ref quoting.

## The loop

Use `find` when you know the role or exact name. Otherwise map the app first and drill into one region.

```
agent-desktop snapshot --skeleton --app "Notepad" -i --compact   # shallow map; children_count on cut branches
agent-desktop snapshot --root @s8f3k2p9:e3 -i --compact          # drill into one region
agent-desktop click @s8f3k2p9:e12                                # act on a qualified ref
agent-desktop snapshot --root @s8f3k2p9:e3 -i --compact          # verify: re-read the same region
```

- A small app needs no skeleton. Take a full `snapshot -i`.
- `-i` keeps interactive nodes only, so a row's static-text label is dropped. To tell which row a repeated
  button belongs to, drill that row's container with `--root` and leave out `-i`.
- A `--root` drill adds its refs to the same snapshot id. Refs outside the drilled subtree, and the drilled root
  itself, stay valid; refs that were already inside it are replaced, so an old ref there returns `STALE_REF`.
- Never skeleton a surface (`--surface menu`, `sheet`, `alert`). A surface is already focused.
- An action that opens a menu, sheet or alert lists it in `data.surfaces`. Target that overlay next.
- After an async step, use `wait`. A fixed sleep is a race.

## Refs

- Output refs are qualified: `@<snapshot_id>:e<N>`, for example `@s8f3k2p9:e1`. Pass them to later commands as
  they are.
- Refs are valid for one snapshot. After any UI change, re-drill the affected region or take a new snapshot.
- Only addressable elements get refs. Static text and inert containers do not.
- A command re-identifies the element before it acts. On Windows and Linux a ref resolves only when it was the
  only element in the window its snapshot captured with its role, native id, name and description, and exactly
  one live element still matches. Identical twins there have no ref path: only `--headed mouse-click --xy X,Y`
  can choose one, and it takes the foreground.
- `STALE_REF`: the element is gone or no longer matches. Take a fresh snapshot and use the new ref.
- `AMBIGUOUS_TARGET`: an identical element appeared, or the ref was not proven unique at capture. Act on a
  control that is unique in the window.
- `TIMEOUT` with `details.kind: resolution_identity_unknown`: nothing was sent; read again and retry.
- `SNAPSHOT_NOT_FOUND`: the snapshot id expired. Snapshot again.

## Delivery and retry

Action results carry `data.disposition` and errors carry `error.disposition`, each with `delivery` and `retry`.

- Retry or substitute an action only when `disposition.retry` is `safe`. Only `not_delivered` is safe.
- Any other delivery value means the action may have landed. A repeat can click, type or submit twice, and
  `toggle` can undo itself.
- On a result that is not safe, read the live state (`get`, `is`, or a fresh snapshot) and decide from that.
- Branch on `error.code` and `error.disposition`. Message and suggestion text can change.
- `details.retryable: false` means waiting cannot change the outcome. Try a different approach.

## Headless and headed

Ref actions are headless by default. They use semantic accessibility calls and do not take focus, move the
cursor, synthesize keys or use the clipboard. If no semantic path exists, the action fails closed. Use the global
`--headed` flag only when the person explicitly permits physical input, such as double-click, hover, drag, or
focus. Never switch to headed mode to recover from a headless failure.

## Windows first contact

- **Quote every ref in PowerShell** (`set-value '@s8f3k2p9:e1' hi`), or PowerShell deletes the argument.
- **A window behind another window is drivable; a minimized one is not.** `restore --app <image>` first. Do not
  use `focus-window` by reflex: it steals the person's foreground.
- **No permission dialog exists.** `permissions` reports automation as `not_required`; elevation boundaries are
  the only access control.
- **Chromium and Electron apps read thin before they settle.** Pass a longer `--timeout-ms` to `snapshot`
  instead of concluding the tree is empty.
- **`type`, `right-click`, `double-click`, `triple-click` and `focus` need `--headed`.** Prefer `set-value`.
- **`launch` takes an absolute path or a bare executable name** (`notepad.exe`), not a display name.
- **Stateful actions run once, then verify by re-reading.** `delivered_verified` means the readback matched;
  `ACTION_FAILED` with `details.kind: post_action_verification` means it landed but reads differently — do not
  retry.

## Privacy

Snapshots, clipboard reads, screenshots, command output and debug artifacts can contain private desktop content.
Keep them out of public logs and uploads, and summarise rather than dumping the tree when the person is sharing
their screen.

## References

Load one only when needed; the binary serves the version-matched copy:
`agent-desktop skills get desktop <reference>`.

| Reference | Open it when |
|-----------|--------------|
| `commands-observation` | You need `snapshot`, `find`, `get`, `is`, `screenshot`, `list-surfaces` semantics, partial trees, or the `--root` rules |
| `commands-interaction` | You choose between click, type, set-value, select, toggle, scroll, press and mouse commands, or you debug an action error |
| `commands-system` | You launch or close apps, manage windows, use the clipboard, `wait`, `batch`, sessions, multi-agent cursors, tracing, or load skills |
| `workflows` | You want worked patterns (forms, menus, dialogs, waiting for a new window, scroll-find, drag) and the anti-patterns list |
