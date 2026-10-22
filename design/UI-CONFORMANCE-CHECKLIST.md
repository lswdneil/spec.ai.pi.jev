# Dense UI conformance checklist

Reference: `design/archive/phase-0-dense/dense-confirmed.html` (Dense overrides, lines 1950-2185).
Status values: PASS = matches; FIXED = mismatch found and corrected; N/A = demo-only measure with no app analogue.

## 1. Tokens

| Check | Reference | Implementation | Status |
| --- | --- | --- | --- |
| Dark background / text | `#1c1d1c` / `#dedfdd` | `--sv-bg` / `--sv-text` | PASS |
| Light background / text | `#f0f2ef` / `#232b26` | `--sv-bg` / `--sv-text` | PASS |
| Brand | `#b5cea5` | `--sv-brand` | PASS |
| Light brand text | `#4e653f` | `--sv-brand-ink` | PASS |
| Body / small / meta / h1 | 13 / 11.5 / 12 / 20 px | `--sv-fs-*` | PASS |
| Caption / body-large / title | 11.5 / 15 / 18 px | `--sv-fs-*` | FIXED |
| Radius | control 8, chrome 10, popup 10, composer 12, dialog 12, small 8, pill 999 | `--sv-r-*` | PASS |
| Layout | sidebar 208, rail 300, topbar 40 | `--sv-sidebar/rail/topbar` | PASS |
| Motion | fast 120, base 160, enter 220, ease `(.2,.7,.2,1)` | `--sv-t-*` / `--sv-ease` | PASS |
| Shadows | none | Dense sheets and primitives use borders | PASS |
| One accent | brand only | no second accent in Dense primitives | PASS |
| Token precedence | Dense mappings beat colour-scheme blocks | `html[data-sv-ui="dense"][data-theme]` | FIXED |
| Raw theme values | token sources only | UI sheets use tokens; see `HARDCODING-AUDIT.md` | FIXED |

## 2. Shell

| Check | Reference | Status |
| --- | --- | --- |
| Sidebar padding / gap | 8 / 8 | PASS |
| Sidebar brand height | 26 | PASS |
| New session | 28 high, 13 label | UPDATED for readability |
| Nav rows | 27 high, 13, radius 5 | UPDATED for readability |
| Conversation rows | 27 high, 13, radius 5, pad 10/6 | UPDATED for readability |
| Active conversation mark | 2 x 11 brand bar | FIXED |
| Section label | 12, UI typeface | UPDATED |
| Empty-state copy | 12, UI typeface | FIXED |
| Account avatar | 22 | PASS |
| Topbar | 40 high, pad 10, gap 8 | PASS |
| Crumbs / chips | 11 / 24 high | FIXED |
| Composer wrap | pad 7/14/10 | PASS |
| Composer | pad 7/9/5, radius 12, text 12.5 | PASS |
| Home composer placeholder | 13px, UI typeface | FIXED |
| Send button | 26 x 26 | PASS |
| Composer note | 9.5 | PASS |
| Hero status pill | 12, UI typeface | FIXED |
| Kernel status bar | 11.5, UI typeface | FIXED |
| Thread message body | 12.5 / 1.55 | PASS |
| User bubble | pad 8/10, radius 8/8/2/8 | PASS |
| Tool card | margin 8, radius 5, head 26, code 10.5 | PASS |
| Judge rail | pad 10, head 11 | PASS |
| Mobile nav label | 9 | PASS |

## 3. Settings

| Check | Reference | Status |
| --- | --- | --- |
| Settings nav row | 27 high, 11, radius 5 | PASS |
| Settings rail typeface | group headers and page rows both use `--sv-font-ui` | FIXED |
| Settings eyebrow / list headings | UI typeface and type tokens | FIXED |
| Settings nav padding | 16 / 8 | PASS |
| Settings main padding | 18 / 22 / 28 | FIXED |
| Settings heading | 20 | PASS |
| Theme grid gap | 8 | PASS |
| Theme mini height | 86 | PASS |
| Appearance page frame | same header/frame as System and Conversations | FIXED |
| Settings page background | theme page background (`--sv-bg`) | FIXED |
| Settings sidebar scrollbar | hidden at rest, visible while scrolling | FIXED |

## 4. Native surfaces and controls

Native `<button>` paints a light system background unless reset. Each surface below was checked and fixed:

| Surface | Status |
| --- | --- |
| Select trigger and option rows | FIXED |
| Menu / Dropdown / submenu items | FIXED |
| Tree nodes | FIXED |
| Segmented Radio options | FIXED |
| Switch track and thumb | FIXED |
| Collapse header | FIXED |
| Dialog close | FIXED |
| Image preview close | FIXED |
| Input clear / InputTag remove | FIXED |
| Pagination buttons | FIXED |
| Popconfirm cancel | FIXED |
| Tabs trigger | FIXED |
| Tag close | FIXED |

## 5. Interaction and overlays

| Check | Status |
| --- | --- |
| Text fields and settings search focus | FIXED (strong hairline only; no ring or accent bar) |
| Native fields / buttons | FIXED (inherit the app UI typeface) |
| Focus after closing the command palette | FIXED (inset sage hairline; no clipped purple bar) |
| Popovers above the welcome screen | FIXED (`screen` z 50, popovers 60/70) |
| Language menu opens and switches language | FIXED |
| API key service menu is selectable | FIXED |
| Selection menus have readable text on dark surfaces | FIXED |
| Switch keeps 32 x 18 in both states and thumb stays inside | FIXED |
| Sidebar scrollbar appears only while scrolling | FIXED |

## 6. Welcome

| Check | Status |
| --- | --- |
| Lead uses the full intro column | FIXED (920px, no `balance`) |
| One UI font family | FIXED (no local mono overrides) |
| Small labels share 11.5px | FIXED |
| Language and service popovers are above the guide | FIXED |
| Chinese and English copy switch correctly | PASS |

## 7. Verification

- `bunx tsc --noEmit`
- `bun run lint`
- `bun run package`
- `bunx vitest run` (full desktop suite)
- Focused regressions:
  - `tests/unit/renderer/settingsFrame.test.ts`
  - `tests/unit/renderer/sidebarTypography.test.ts`
  - `tests/unit/renderer/themeTokens.test.ts`
  - `tests/unit/renderer/nativeButtonSurfaces.test.ts`
  - `tests/unit/renderer/fieldFocusSurfaces.test.ts`
  - `tests/unit/renderer/radioSurface.dom.test.tsx`
  - `tests/unit/renderer/switchGeometry.dom.test.tsx`
  - `tests/unit/renderer/menuSurfaces.test.ts`
  - `tests/unit/renderer/welcomeStyles.test.ts`
  - `tests/unit/renderer/languageSwitcher.dom.test.tsx`

App-specific adaptation: settings content stays in the shared 880px column for readability. The reference demo has no responsive app column, so this is not a mismatch.
