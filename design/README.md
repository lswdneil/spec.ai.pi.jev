# spec.jev design (Phase 0–2b)

Static design work only. No existing app code was changed.

## Open

Open `preview/index.html` in a browser (file:// works). Each direction has three screens:

- **Conversation** — app shell, thread, tool call, judge rail, composer.
- **Appearance** — Settings → Appearance with Dark / Light / Auto.
- **Mobile** — 390px conversation with bottom navigation.

The theme switcher (Dark / Light / Auto) is live. `Auto` follows the OS.

Direct links:

- `preview/freebuff.html`
- `preview/editorial.html`
- `preview/dense.html`

URL parameters: `?screen=conversation|appearance|mobile&mode=dark|light|auto`.

## Files

| File | Purpose |
| --- | --- |
| `DESIGN.md` | The design contract: tokens, contrast, type, components, states, accessibility, anti-slop. |
| `tokens.json` | Source of truth for color, type, space, radius, motion. |
| `tokens.css` | Runtime CSS variables; no raw hex outside this file. |
| `INVENTORY.md` | What exists (887 renderer files), what to keep, what to replace, waves. |
| `ARCO-MIGRATION.md` | Compatibility-layer plan to remove Arco without rewriting 210 files. |
| `preview/template.html` | Shared markup for the three directions. |
| `preview/preview.css` | Shared shell + per-direction overrides. |
| `preview/preview.js` | Theme and screen switching. |
| `preview/build.mjs` | Generates the three direction files. |
| `preview/verify.mjs` | Playwright check: screenshots, theme application, 390px overflow. |
| `preview/shots/` | Latest screenshots (3 directions × 3 screens × dark/light, plus index). |

## Phase 1 implementation (in the app)

The Dense foundation is now in `desktop/packages/desktop/src/renderer`:

- `styles/specjev/tokens.css` — `--sv-*` tokens (namespaced; no collision with Arco).
- `ui/` — Radix + UnoCSS primitives: Button, Input, Tooltip, Modal/Dialog, Dropdown,
  Switch, Tag, Alert, Spinner, Empty, Card, Tabs, toast.
- `pages/DesignSystem` — internal gallery with a static Dense shell, primitives and states.
- `pages/settings/AppearanceSettings/AppearanceV2.tsx` — the three-mode Appearance page.

Enable the preview (feature flag):

```js
localStorage.setItem('specjev.ui.v2', '1')
```

Then reload and open Settings → Appearance, or go to `#/design-system`.
Disable with `localStorage.removeItem('specjev.ui.v2')` or `?ui=v1`.

The gallery stays a static reference; the real shell is wired behind the flag.

### Phase 2: Dense shell (in progress)

With the flag on, the app uses the Dense chrome:

- `components/layout/Sider/DenseSider.tsx` — new 208px sidebar: brand row, New session,
  Search, Scheduled tasks, Skills, batch selection, then the existing conversation history
  and footer. The rail keeps named icon buttons; settings still uses its own rail.
- `components/layout/MobileTabBar.tsx` — four phone tabs: sessions, search, new, settings.
- `pages/conversation/components/ChatLayout` — a 40px conversation header with the
  workspace/conversation breadcrumb, inline rename, existing actions and a judge-rail toggle.
- Work panel: on a window at least 1280px wide, Dense starts it open on the judge tab at
  300px; narrower windows start it closed, and the toggle plus per-conversation memory still
  apply. It uses its own storage key so old non-Dense choices do not decide it.
- `styles/specjev/dense.css` — the app's semantic variables, Arco palette and `--mu-accent-*`
  map onto `--sv-*`; base text 13px, titlebar 40px, settings title 20px; Arco buttons,
  switches, checks and focus rings are sage; popups lose their shadows.
- Message body: the shadow Markdown view reads `--chat-line-height` and
  `--chat-paragraph-margin`, so Dense replies get the 1.65 rhythm while the person's own
  chat font size still applies; user bubbles are flat with an 8/2px corner.
- Composer: flat field, 18px radius, 13px input, sage send button.
- Command palette: 14px popup, 40px query, 28px rows and 12px labels when Dense is on.
- Sidebar width uses `sider-width-px-v2`, separate from the old 260px preference.
- Welcome: the hero stays, the violet glow/dot grid goes, and the new-conversation card is a
  flat 18px field like the composer.

Still old in this slice: the settings rail markup (it already uses 32px rows and 13px labels)
and the ACP tool/terminal cards.

The v2 shell and the legacy sidebar have no runtime Arco imports left: their layout, rows,
native group, command palette, settings rail, dialogs, update notice and kernel bar use
`@/ui` or plain elements. Arco remains in 130 business files across the rest of the renderer,
and `MuModal` keeps only its `ModalProps` type.

## Build and verify

```bash
node design/preview/build.mjs
node design/preview/verify.mjs
```

The verifier needs Playwright and Chromium. It uses the Chromium already installed for the desktop E2E tests.

## Decisions

1. Direction: **Dense**.
2. Mobile: remote host client.
3. Arco removal: compatibility layer + codemod.
4. Judge rail: hybrid (expanded ≥1280, auto-collapsed 1024–1279, hidden <1024 with a toggle).

Open: the exact rail breakpoint (1180 vs 1280) and PWA vs Capacitor first.
