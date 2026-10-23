# spec.jev — design contract (Phase 0)

Status: **proposal**, 2026-10-22. Three static directions are in `design/preview/`. Pick one, then this document becomes the implementation contract.

Scope: replace the AionUI interface with spec.jev's own shell and visual language, keep the Electron app and the existing business logic. No Arco Design in the target.

---

## 1. Source of truth

- **Palette**: verified against Freebuff's published desktop CSS (`--dk-*` tokens) on 2026-10-22. The five values under discussion all exist in that CSS:
  - dark workspace `#1c1d1c`, text `#dedfdd`, brand `#b5cea5`
  - light workspace `#f0f2ef`, text `#232b26`, brand `#b5cea5`
  - correction: `#b5cea5` is Freebuff's **brand**, not its `--dk-accent`. Their accent is the text color in dark, `#303832` in light.
- **Craft rules**: `open-design/craft/` (Apache-2.0): one accent, no pure black/white, CJK line-height, state coverage, motion limits, anti-AI-slop.
- **Audit rules**: `ui-ux-pro-max` (MIT): contrast, 44px touch, responsive, focus, empty/error states.
- **Direction audit**: `taste-skill/redesign-skill` (MIT), only as a checklist; its main `taste-skill` is for landing pages, not product UI.
- **Tokens**: `design/tokens.json` is the source; `design/tokens.css` is the runtime copy. No raw hex outside these files.

## 2. Non-negotiables

1. **One UI accent, plus the Jev system accent.** Brand sage is used at most twice per screen: one primary action and one current/selected marker. The judge/Jev system keeps its own pink dot and violet focus/tag accent (`--sv-jev-*`) so it reads as a separate subsystem; do not spread that accent to ordinary UI.
2. **Flat.** No `box-shadow`. Depth comes from surfaces, 1px borders and spacing.
3. **No pure black or white.** Use the verified surfaces.
4. **Three theme modes only**: dark, light, auto (follows the OS). No per-window theme, no custom accent picker.
5. **CJK leading is not optional.** Body 1.7–1.8, headings 1.35–1.4 for Chinese/Japanese/Korean. Latin can be tighter.
6. **Touch target ≥ 44×44px** on mobile, even when the icon is 16px.
7. **No emoji as icons.** Monoline SVG, `currentColor`, 1.75px stroke (Lucide).
8. **Every surface has five states**: loading, empty, error, populated, edge (long strings, no optional data, RTL, partial network). A populated screenshot is not acceptance.
9. **No invented metrics, no lorem ipsum, no generic three-card feature row.**
10. **No Arco imports** in new code. Migration plan: `ARCO-MIGRATION.md`.

## 3. Color

### Dark

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#1c1d1c` | workspace, thread |
| `--chrome` | `#292b2a` | sidebar, window chrome, mobile nav |
| `--surface` | `#222423` | cards, composer, popovers |
| `--surface-2` | `#282a29` | user bubble, code blocks, inputs |
| `--raised` | `#303330` | hover, pressed, selected control |
| `--line` | `#2f322f` | decorative 1px borders |
| `--line-strong` | `#767c74` | interactive boundaries, focus-adjacent |
| `--text` | `#dedfdd` | body and headings |
| `--muted` | `#a0a39f` | secondary text |
| `--faint` | `#858984` | metadata; large or non-essential only |
| `--brand` | `#b5cea5` | primary action fill, current marker |
| `--brand-ink` | `#b5cea5` | brand text on dark |
| `--on-brand` | `#1c211b` | text on brand fill |
| `--jev-pink` | `#f06bc9` | Jev status dot; judge system only |
| `--jev-violet` | `#8f7cf7` | Jev focus, tags and readouts; judge system only |
| `--danger` / `--warn` / `--ok` | `#e7a3a3` / `#f5c86f` / `#b5cea5` | semantics |

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f0f2ef` | workspace |
| `--chrome` | `#e3e7e4` | sidebar, chrome |
| `--surface` | `#f7f8f5` | cards |
| `--surface-2` | `#e9ede8` | user bubble, inputs |
| `--raised` | `#dfe5df` | hover/pressed |
| `--line` | `#d8ded8` | decorative borders |
| `--line-strong` | `#7f8a7f` | interactive boundaries |
| `--text` | `#232b26` | body |
| `--muted` | `#5d6962` | secondary |
| `--faint` | `#667168` | metadata (4.52:1, small text only at ≥12px) |
| `--brand` | `#b5cea5` | fill only |
| `--brand-ink` | `#4e653f` | brand text/link on light |
| `--on-brand` | `#232b26` | text on brand fill |
| `--jev-pink` | `#d63fa2` | Jev status dot; judge system only |
| `--jev-violet` | `#7f6af0` | Jev focus, tags and readouts; judge system only |

Contrast gates (verified):

| Pair | Ratio |
| --- | --- |
| dark text / bg | 12.65 |
| dark muted / bg | 6.63 |
| dark brand / bg | 9.93 |
| dark on-brand / brand | 9.62 |
| light text / bg | 12.91 |
| light muted / bg | 5.09 |
| **light brand / bg** | **1.51 — never text** |
| light brand-ink / bg | 5.73 |
| light on-brand / brand | 8.54 |

Usage notes:

- Light mode: sage is a **fill**, or `--brand-ink` for text. Never `--brand` for body text, links or small icons.
- Borders are decorative at ~1.2–1.3:1. Any control whose boundary is the only affordance uses `--line-strong` (3.19–3.95:1) or an explicit focus ring.
- Semantic colors are for meaning only, not decoration.
- Accent budget per screen: **2** for the UI accent. In the prototypes: selected session + send (conversation); selected theme card + check (appearance); active tab + send (mobile). Jev status/focus/tag marks are a separate system accent.

## 4. Typography

```
--font-ui:    "Segoe UI Variable", "Segoe UI", -apple-system, "Noto Sans SC", sans-serif
--font-serif: "Iowan Old Style", "Palatino Linotype", Georgia, "Noto Serif SC", serif
--font-mono:  "Cascadia Code", "SFMono-Regular", Consolas, "Noto Sans Mono", monospace
```

- Dense (approved direction): UI base **13px**; sidebar primary labels 13; sidebar section headers and empty-state copy 12; small 11.5; caption 11.5; meta 12; h1 20; hero display 34. Editorial alternatives may use 14/26.
- UI labels and prose use `--sv-font-ui`. Monospace is only for code, identifiers, timings and commands. Colours come from `--sv-*` tokens (or the mapped legacy theme variables); raw colours live only in token sources and documented data/preview exceptions. Jev status, focus and tags use `--sv-jev-pink` / `--sv-jev-violet`; everything else uses the Dense sage accent.
- Line-height: body **1.65** (CJK 1.7–1.8), headings **1.35** (CJK 1.35–1.4), small 1.5.
- Weights: 400 / 500 / 600 only. No 700 body.
- Numbers in tables and timing: `font-variant-numeric: tabular-nums`.
- Prose max width: 65–72 characters; thread max 820px.
- Truncation: one line for titles with ellipsis; never truncate error messages.
- No letter-spacing on CJK; negative tracking only for large Latin headings.
- `text-wrap: balance` for headings, `pretty` for paragraphs where supported.

Editorial direction: serif for display/headings only; UI controls stay sans. Dense direction: 13px base, monospace for metadata, never below 11px.

## 5. Space, radius, motion

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Layout uses 12/16/24; section gaps 24–32.
- Radius (Dense): small **8**, control **8**, chrome/popup **10**, composer/dialog **12**, pill 999.
- Motion: instant 80ms, fast 120ms, base 160ms, enter 220ms; ease `cubic-bezier(.2,.7,.2,1)`.
- Interactive list rows (menus, selects, trees, palettes, history, settings rail) show a 2px brand leading bar on hover/selection.
- Hover menus wait briefly before opening and stay open while the pointer crosses the gap into the menu; they close only after both the trigger and the menu are left.
- Animate only navigation, expansion, progress, gesture follow-through. No looping decorative motion.
- Honor `prefers-reduced-motion`; all durations become 0.
- No shadows. Optional squircle (`corner-shape`) is a progressive enhancement for Chromium only.

## 6. Layout and platforms

| Surface | Rule |
| --- | --- |
| Desktop 1280+ | sidebar 208 + thread + judge rail 300; brand and sidebar fold live in the sidebar header |
| 1024-1279 | rail collapses; sidebar remains |
| 768-1023 | sidebar hidden behind a menu; single column |
| < 768 | mobile shell: top bar 44, bottom nav 50 + safe area; composer above nav |
| Web | same renderer via `web-host`; responsive rules above |
| Android/iOS | same renderer in Capacitor/PWA; remote host; 44px targets, `dvh`, `env(safe-area-inset-*)` |

- Use `min-height: 100dvh`, not `100vh`.
- Never rely on hover for essential actions; hover is an enhancement.
- Keyboard: visible focus ring `2px solid var(--focus)` offset 3px; focus never hidden behind sticky chrome.
- Window controls: right-aligned on Windows/Linux; keep the 44px drag region. On macOS the system traffic lights replace them.
- WebKitGTK/WKWebView: no `corner-shape`; test `backdrop-filter` and `color-mix()` fallbacks. Avoid effects that only work in Chromium.

## 7. Components

| Component | Rules |
| --- | --- |
| Button | 32/36/44 heights; primary = brand fill + on-brand; secondary = transparent + `--line`; ghost = text + hover surface. No shadow. |
| Icon button | 30×30 desktop, 44×44 mobile; 16px icon; `aria-label` always. |
| Input / textarea | `--input` surface, 1px `--line`, 8px radius; focus changes border to `--line-strong` and shows ring; label is always visible. |
| Chip / tag | 24–28 height, pill; neutral by default; brand only for the current state. |
| Card | `--surface`, 1px `--line`, 10px radius, 12-16 padding. No left-border accent. |
| Message | user: `--surface-2`, right aligned, radius 8/8/2/8; agent: no bubble, 22px mark + body. |
| Tool call | 1px card, header 26px with icon + command + status, monospace body; exit status uses `--ok`/`--danger`. |
| Composer | 12px radius, `--surface`, textarea + control row; send is the only brand fill on the screen. |
| Judge verdict | neutral card with a dot; score right-aligned mono; no green flood. |
| Settings card | 3 theme cards, mini preview, selected ring in brand; no shadows. |
| Dialog / sheet | `--popover`, 12px radius, scrim; mobile uses a bottom sheet (vaul). |
| Empty state | headline + one plain sentence + primary action; no illustration required. |
| Toast | sonner, bottom-right desktop, top mobile; one line + action; no auto-dismiss for errors. |

## 8. Appearance page (spec)

- Route: Settings → Appearance.
- Header: title + one sentence. No “Save” button; changes apply instantly.
- Exactly three cards: **Dark**, **Light**, **Auto**.
- Each card: mini app preview (sidebar, message, composer, sage send), label, one-line description, check on the selected card.
- Auto card shows the resolved mode: “Following the system · dark/light”.
- Below: a live preview panel (bubble + reply + composer) using the actual tokens.
- Footnote: palette is fixed; no custom accent picker.
- Keyboard: cards are buttons in a radiogroup; arrow keys move selection; Enter/Space applies.
- Persist locally; no server round-trip; no flash on startup (apply tokens before first paint).

## 9. State coverage

Every list, panel and form ships all five:

| State | Minimum |
| --- | --- |
| Loading | skeleton or spinner; after 15s “taking longer than expected” |
| Empty | headline, explanation, primary action |
| Error | plain cause, recovery action, preserved input |
| Populated | the designed case |
| Edge | 200-char title, missing avatar, 10k rows, long paths, RTL, offline |

Forms add untouched / dirty-valid / submitted-pending; validate on blur, then live after first blur.

## 10. Accessibility

- Contrast: body 4.5:1, large text 3:1, UI boundaries 3:1.
- Focus visible on every interactive element; never remove rings.
- Landmarks: sidebar `nav`, thread `main`/`section`, rail `aside`, composer form.
- Icons decorative `aria-hidden`; icon-only buttons have labels.
- Status messages use `role="status"`/`aria-live="polite"`; errors `role="alert"`.
- Keyboard: Cmd/Ctrl+K palette; Esc closes overlays; focus returns to the trigger.
- Reduced motion respected; no animation is required to understand state.
- RTL: use logical properties (`margin-inline`, `inset-inline`) from day one.

## 11. Anti-slop list

- No default indigo/violet AI accent; our accent is sage.
- No purple→blue hero gradient, no glassmorphism everywhere.
- No emoji icons; no sparkle/rocket/lightning.
- No three equal feature cards; no left-border accent cards.
- No invented numbers (“10×”, “99.9%”) or lorem ipsum.
- No pure `#000`/`#fff`; no 6+ raw hex values outside tokens.
- No shadows; no border + shadow “depth” combo.
- No centered everything; product UI is left-aligned and task-first.
- No animation loops; no motion that blocks input.

## 12. Token governance

1. Edit `design/tokens.json`.
2. Mirror to `design/tokens.css` (prototypes) and `renderer/styles/specjev/tokens.css` (`--sv-*`, the app). No raw hex in components.
3. Components use semantic tokens, never palette names (`--sv-brand`, not `--green`).
4. UnoCSS is the utility layer already in the project; new primitives use Uno utilities plus `--sv-*` values. No Tailwind install.
5. One UI accent; the Jev subsystem owns pink/violet status, focus and tag marks. If a non-Jev screen needs a second emphasis, use weight/surface, not a new color.
6. Arco imports and the package are gone; remaining legacy variables live in `legacy-overrides.css` and `mu-scales.css`. New work uses `--sv-*` only.
7. Any new component must document its five states and its mobile behavior.

## 13. Decisions

Chosen on 2026-10-22:

1. **Direction: Dense.** 13px UI, tight rows, judge rail visible on wide screens.
2. **Mobile: remote host client.** The renderer is the same; the agent stays on the desktop/web host.
3. **Arco: compatibility layer + codemod.** Wrap the top components, batch-change imports, replace complex widgets one by one.
4. **Judge rail: hybrid.** Expanded at 300px, auto-collapsed 1024-1279px, hidden <1024px with a manual toggle and a remembered preference.

Still open: the final window width at which the rail auto-collapses (1180 vs 1280) and whether the mobile client is a PWA first or a Capacitor wrapper first.
