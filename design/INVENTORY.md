# UI inventory and replacement map (Phase 0)

Measured on 2026-10-22 from `desktop/packages/desktop/src/renderer`.

> Phase 1 status: tokens (`--sv-*`), the `ui/` primitives, the internal `DesignSystem` gallery and the
> flag-gated `AppearanceV2` page are in the app. The production shell is still the old one until Phase 2.

## 1. Size

| Item | Count |
| --- | --- |
| renderer files (ts/tsx/css) | **887** |
| files with a named `@arco-design/web-react` import | **210** (about 220 reference Arco in total) |
| CSS Modules | 37 |
| `pages/conversation` | 285 |
| `pages/settings` | 99 |
| `pages/native` | 39 |
| `components/layout` | 36 |
| `pages/guid` | 22 |
| `pages/cron` | 12 |
| `pages/welcome` | 10 |
| `pages/team` | 5 |

The shell is small; the product surfaces are large. That is why the plan replaces the shell and the chrome first, and reuses message rendering, Monaco, diff, browser panels and forms.

## 2. Arco usage, by component

| Count | Component | Target |
| --- | --- | --- |
| 116 | `Button` | `ui/Button` (Radix Slot + Tailwind) |
| 65 | `Message` | `sonner` |
| 55 | `Tooltip` | `ui/Tooltip` (Radix) |
| 31 | `Input` | `ui/Input` |
| 27 | `Modal` | `ui/Dialog` (Radix) |
| 25 | `Spin` | `ui/Spinner` / skeletons |
| 23 | `Dropdown`, `Menu` | `ui/Menu` (Radix DropdownMenu) |
| 22 | `Tag` | `ui/Badge` |
| 17 | `Switch` | `ui/Switch` (Radix) |
| 12 | `Alert` | `ui/Alert` |
| 10 | `Checkbox` | `ui/Checkbox` (Radix) |
| 9 | `Typography`, `Empty`, `Collapse`, `Radio` | `ui/Text`, `ui/Empty`, `ui/Accordion`, `ui/RadioGroup` |
| 7 | `Select` | `ui/Select` (Radix Select / cmdk Combobox) |
| 5 | `Image` | native `img` + `ui/Image` |
| 4 | `Popover`, `InputNumber`, `Form`, `Card`, `Badge` | `ui/Popover`, `ui/NumberInput`, `react-hook-form`, `ui/Card`, `ui/Badge` |
| 3 | `Popconfirm`, `Notification`, `Layout`, `Avatar` | `ui/Confirm`, `sonner`, shell grid, `ui/Avatar` |
| 2 | `Steps`, `Tabs`, `Space` | `ui/Steps`, `ui/Tabs`, `ui/Stack` |

A compatibility layer for the top 10 covers roughly **75–80%** of call sites without touching page logic.

## 3. Surface map

| Surface | Files | Decision | Priority |
| --- | --- | --- | --- |
| App shell (`Layout`, `Sider`, `Titlebar`, `Router`, `WindowControls`, `CommandPalette`) | 36 | **Replace** markup + tokens; keep routing and IPC | P0 |
| Welcome / first run | 10 | **Rebuild** (new brand moment) | P0 |
| Conversation chrome (header, composer, panels, permission cards) | ~60 of 285 | **Replace chrome**; keep message/tool/markdown/editor/browser internals | P0 |
| Conversation internals (messages, tool calls, diff, Monaco, judge panel, hive) | ~225 | **Keep**; restyle through tokens and wrappers | P1 |
| Settings shell and navigation | ~15 of 99 | **Replace**; Appearance first | P1 |
| Settings forms (models, judges, permissions, skills, MCP) | ~84 | **Keep logic**; swap controls through `ui/` | P1–P2 |
| Native host surface | 39 | **Share** primitives; replace dialogs/sheets | P2 |
| Cron | 12 | **Restyle**; keep logic | P2 |
| Team | 5 | **Restyle**; keep logic | P2 |
| Guid | 22 | **Restyle**; keep logic | P2 |
| Shared components (Markdown, Monaco, Diff, browser, charts) | — | **Keep**; theme via tokens | — |

## 4. What not to rewrite

Do not rebuild these just for the redesign:

- ACP session and tool-call rendering; judge verdict pipeline; permission flow.
- Markdown, code highlighting, diff view, Monaco, terminal, browser/CDP panels.
- i18n plumbing and the five locales.
- Session storage, IPC bridge, web-host, native host.

Rewriting them would multiply cost without changing the perceived design.

## 5. Migration waves

### Wave 0 — contract and prototypes (done in this phase)

- `DESIGN.md`, `tokens.json`, `tokens.css`.
- Three static directions.
- Inventory and Arco plan.

### Wave 1 — foundation (3–5 days)

- Add Tailwind v4, Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`.
- Create `renderer/ui/` with the top 10 wrappers.
- Add `PlatformBridge` for Electron/Web (Tauri later, if ever).
- Feature flag `specjev.shell` (new shell vs old).

### Wave 2 — shell + Appearance (5–7 days)

- New sidebar, top bar, command palette, window controls.
- Appearance page with the three cards and live preview.
- Welcome screen.
- Mobile navigation (bottom nav + drawer) at <768px.

### Wave 3 — conversation chrome (5–7 days)

- Header, thread container, judge rail, composer, permission card, tool card styling.
- Keep message internals; fix CJK line-height and long-path overflow.
- Empty/loading/error states.

### Wave 4 — settings and Arco removal (5–7 days)

- Settings nav + forms through `ui/`.
- Replace Table/Tree/DatePicker/Upload/Form.
- Remove `@arco-design/web-react`, `arco-override.css`, Arco theme variables.
- Delete dead CSS.

### Wave 5 — validation (3–4 days)

- Playwright screenshots at 1440, 1024, 768, 390.
- Contrast, focus, keyboard, reduced motion.
- Web-host and Capacitor smoke tests.
- Visual regression for the eight key screens.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| 210 Arco files × subtle prop differences | Compat wrappers mirror the existing prop names; codemod; per-wave tests |
| Imperative `Message`/`Notification` call sites | Provide `toast` facade with the same call signatures before removing Arco |
| Complex widgets (Table, Tree, DatePicker, Upload) | One wrapper per widget, built on TanStack Table, react-arborist, react-day-picker, react-dropzone |
| CJK layout breaks | Enforce 1.7–1.8 body leading and test with zh-CN/zh-TW/ja/ko |
| Mobile WebView differences | Avoid `corner-shape`; test WebKitGTK/WKWebView; use `dvh` + safe areas |
| Visual regressions in 285 conversation files | Screenshot the 8 key screens; keep old shell behind a flag until parity |
| Bundle growth | Import primitives per component; no whole-library imports; measure before/after |

## 7. Acceptance for the redesign

- No `@arco-design` import remains.
- `tsc --noEmit` clean; existing tests pass except known environmental failures.
- 8 key screens match the chosen direction in dark and light at 1440/1024/390.
- Contrast and focus checks pass; reduced motion works.
- Settings → Appearance contains exactly Dark/Light/Auto.
- The app still runs on Linux, Web (`web-host`), and a 390px viewport.
