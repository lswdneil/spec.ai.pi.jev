# spec.jev design (Phase 0)

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

The shell in the gallery is static. Phase 2 wires it to the real router, session store and
judge store; the old shell stays the default until then.

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
