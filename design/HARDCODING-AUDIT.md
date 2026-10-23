# Dense theme and hard-coding audit

The Dense UI reads colour, type, radius and motion from `styles/specjev/tokens.css` and the
legacy theme variables mapped by `styles/specjev/dense.css`. Raw theme values are not allowed in
UI code.

## What is checked

- Raw six- or three-digit colours in CSS, TSX and TS.
- Literal icon sizes in shell components; they use `sv-icon-*` classes backed by `--sv-icon-*` tokens.
- Raw `rgb()` / `rgba()` values that are not built from a variable.
- Literal `font-family` declarations.
- Dense labels use `--sv-font-ui`; monospace is reserved for code, identifiers, timings and
  commands.

Automated guard: `desktop/tests/unit/renderer/themeTokens.test.ts`.

## Fixed in this pass

- `MuHero`: status pill now uses the UI typeface and `--sv-fs-meta`, not mono 11px.
- `KernelBar`: status line and tag now use the UI typeface and type tokens.
- Settings page eyebrow and provider list headings now use the UI typeface and type tokens.
- Dense token block now outranks the colour-scheme blocks (`html[data-sv-ui="dense"][data-theme]`),
  so sage tokens win over the old lavender/pink values.
- Brand pulse and halo, mobile action sheet, send box placeholders, home composer, file attach
  button, assistant selector and preview context menu now use theme tokens.
- Removed raw colours and literal shadows from the guide page, legacy overrides, search overlay,
  tool call row, minimap, markdown surface, scale control, workspace selector and mobile overlay.
- Removed literal font-family fallbacks from code/ID styles and the welcome page.
- Added `--sv-fs-display` for the home hero title.

## Allowed exceptions

These are data or non-theme values, not UI styling:

- Token sources: `styles/themes/*`, `styles/specjev/tokens.css`, `styles/colors.ts`.
- Theme preview swatches in `AppearanceV2.module.css`: each preview must show a mode even while
  another mode is active.
- Custom theme presets in `CssThemeSettings.tsx`: these are user data.
- Brand logos and wordmarks in `ProviderMark.tsx`.
- Syntax highlighting: `markdownHighlightStyle.ts`, `WavedromBlock.tsx`,
  `diff2htmlTemplates.ts`, `htmlInspectScript.ts`.
- OS window controls in `Titlebar/titlebar.css` (the Windows close button keeps its platform red).
- Functional masks and transparent checks: `CollapsibleContent.tsx` mask alpha,
  `minimapUtils.ts` transparent comparison.
- Console-only CSS in `Layout.tsx` and `useAcpMessage.ts`.
- External page inspector outline in `HTMLViewer.tsx`.
- The component demo page `TestShowcase.tsx`.

`rgba(var(--primary-6), …)` and other `rgb(var(--…))` forms are token-derived and allowed.
