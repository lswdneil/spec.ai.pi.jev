# Pending work

## Deferred: remove the legacy MU UI and Arco compatibility layer

Status: not started. Do not begin without explicit approval.

Recorded: 2026-10-23.

The default UI is Dense, but the old MU/AionUi shell and its compatibility
layer are still shipped:

- `?ui=v1` fallback and the old `Sider` (replaces `DenseSider`).
- Legacy branches in `Layout`, `AppearanceSettings`, `WorkPanel`, and
  conversation layout.
- `legacy-overrides.css`, `themes/mu-scales.css`, and `themes/mu-shell.css`.
- `arco-*` class names emitted by the new primitives (`button`, `select`,
  `menu`, `tag`, `form`, `spinner`, dialogs).
- Remaining Arco-derived base components such as `MuModal`, `MuSearchInput`,
  `MuInlineSearchInput`, and `MuSteps`.

Scope if approved:

1. Decide whether the `?ui=v1` fallback is removed or kept for one more
   release.
2. Remove the old shell and page branches.
3. Audit tests, extensions, and stored preferences that depend on Arco class
   names or old storage keys.
4. Delete the compatibility CSS and class names in batches, with visual and
   unit regression checks.
