# Removing Arco Design (Phase 0 plan)

Goal: **zero `@arco-design/web-react` imports** in the renderer, without rewriting 210 files by hand.

Strategy: a small compatibility layer that mirrors the Arco APIs we actually use, then a codemod, then per-widget replacement for the complex components.

---

## Status (2026-10-22)

- Renderer `.tsx`/`.ts` files importing `@arco-design/web-react` (components or types): **0**, down from 217.
- Done: tokens, Dense shell, settings, forms, welcome, dialogs, and the primitives in `ui/` — Alert, AutoComplete, Avatar, Badge, Button, Card, Checkbox, Collapse, Dialog/Modal (`confirm`/`useModal`), Dropdown (Radix), Empty, Form, Image, Input, InputNumber, InputTag, Layout, Link/Space/Result/Progress, menu aliases, Pagination, Popover, Popconfirm, Radio, Select, Spinner, Steps, Switch, Tabs, Tag, TimePicker, toast/AppToaster, Tooltip, Tree, Trigger, Typography.
- Done since the last update: `MuSelect` now wraps the Dense Select; `BrowserChrome` uses the Dense Dropdown and Menu; `main.tsx` has no ConfigProvider, Arco locales, adapter or `arco.css`.
- Test imports and `vi.mock('@arco-design/web-react')` blocks are gone; `@arco-design/web-react` was removed from `desktop/package.json`, `desktop/kyrn/package.json`, `bun.lock` and the Electron-Vite chunk config.
- The CSS files are renamed to `legacy-overrides.css` and `mu-scales.css`; no tracked file name says Arco. They keep the app's font tokens and full status-colour scales.
- `tests/unit/renderer/noArcoImports.test.ts` guards renderer source, tests, `package.json` and `bun.lock` against reintroducing the package.
- The Dense shell is the default; `?ui=v1` keeps the legacy shell, and `?ui=v2` clears that choice.
- Last full desktop suite: **6715 passed / 0 failed** (116 skipped); `tsc`, lint and `package` pass.

---

## 1. Target stack

| Need | Choice | Licence |
| --- | --- | --- |
| Styling | UnoCSS (presetWind3, already in the project) | MIT |
| Primitives | Radix Primitives (copied through `ui/`, shadcn-style) | MIT |
| Variants | `class-variance-authority`, `clsx`, `tailwind-merge` | MIT |
| Icons | `lucide-react` | ISC |
| Toasts | `sonner` | MIT |
| Command palette | `cmdk` | MIT |
| Dialog/sheet | Radix Dialog + `vaul` (mobile) | MIT |
| Motion | `motion` | MIT |
| Forms | `react-hook-form` + `zod` | MIT |
| Tables | TanStack Table | MIT |
| Tree | `react-arborist` | MIT |
| Date | `react-day-picker` | MIT |
| Upload | `react-dropzone` | MIT |
| Virtual list | `@tanstack/react-virtual` (existing `react-virtuoso` can stay until replaced) | MIT |
| Diff | existing diff view (keep) | — |
| Code | existing Monaco (keep) | MIT |

Do not add an entire component kit. Copy only the primitives each wave needs.

## 2. Compatibility layer (`renderer/ui/`)

The wrapper layer is the cost saver: page code keeps its current props while the implementation becomes ours.

```
renderer/ui/
  button.tsx        // Button: type: 'primary'|'secondary'|'text'|'outline', size, status, loading
  input.tsx         // Input, InputNumber, Textarea
  select.tsx        // Select + Option, Combobox
  dialog.tsx        // Modal (visible, onCancel, footer, title), Confirm
  tooltip.tsx       // Tooltip (content, position)
  dropdown.tsx      // Dropdown + Menu + Menu.Item
  tabs.tsx          // Tabs + TabPane
  switch.tsx
  checkbox.tsx / radio.tsx
  tag.tsx / badge.tsx
  alert.tsx
  spinner.tsx
  empty.tsx
  avatar.tsx
  card.tsx
  steps.tsx
  form.tsx          // Field wrapper over react-hook-form
  toast.ts          // Message / Notification facade over sonner
```

Rules:

- Wrapper props stay close to Arco's (`type`, `size`, `status`, `visible`, `onCancel`, `content`, `position`).
- Wrapper internals use tokens and Tailwind only.
- No wrapper re-exports Arco types; define our own narrow types.
- Every wrapper has a Storybook-like demo page in the preview folder before adoption.

## 3. Codemod

1. Replace imports:
   ```diff
   - import { Button, Input, Tooltip } from '@arco-design/web-react';
   + import { Button, Input, Tooltip } from '@/ui';
   ```
2. Leave page code unchanged unless TypeScript reports a prop mismatch.
3. Fix imperative calls:
   ```diff
   - Message.success('Saved');
   + toast.success('Saved');
   ```
   The `toast` facade keeps `success/error/info/warning/loading` and returns a dismiss function.
4. Remove global Arco CSS imports and `legacy-overrides.css` only after the last import is gone.

Expected result: ~70–80% of the 210 files compile after the import swap; the rest are complex widgets or prop mismatches.

## 4. Component mapping

| Arco | Replacement | Notes |
| --- | --- | --- |
| `Button` | `ui/Button` | `type="primary"` → brand fill; `status="danger"` → danger text |
| `Input` / `InputNumber` | `ui/Input` / `ui/NumberInput` | Keep `prefix`, `suffix`, `allowClear` shims |
| `Select` / `Option` | Radix Select or cmdk Combobox | Searchable selects use cmdk |
| `Modal` | Radix Dialog via `ui/Dialog` | Keep `visible`, `onCancel`, `footer` |
| `Message` / `Notification` | `sonner` via `toast` | Same call signatures; one provider at app root |
| `Tooltip` | Radix Tooltip | `position` mapped to `side`; delay 300ms |
| `Dropdown` / `Menu` | Radix DropdownMenu | `Menu.Item` → `MenuItem` |
| `Tabs` / `TabPane` | Radix Tabs | Keep `activeTab` shim |
| `Switch` | Radix Switch | `checked` + `onChange` |
| `Checkbox` / `Radio` | Radix Checkbox / RadioGroup | — |
| `Tag` / `Badge` | `ui/Tag` / `ui/Badge` | `color` → semantic tone |
| `Alert` | `ui/Alert` | tone: info/success/warning/error |
| `Spin` | `ui/Spinner` or skeleton | Prefer skeletons in lists |
| `Empty` | `ui/Empty` | Headline + action |
| `Collapse` | Radix Accordion | — |
| `Popover` | Radix Popover | — |
| `Form` / `Form.Item` | `react-hook-form` + `ui/Field` | Validation moves to zod; no Arco rules |
| `Table` | TanStack Table | Per-page migration; keep column definitions close |
| `Tree` | `react-arborist` | File tree, skills tree |
| `DatePicker` | `react-day-picker` + Popover | Locale via date-fns/intl |
| `Upload` | `react-dropzone` | Preserve drag/drop and progress |
| `Image` | `ui/Image` | Preview via Radix Dialog |
| `Steps` | `ui/Steps` | — |
| `Layout` | CSS grid shell | No component needed |
| `Space` | `ui/Stack` or flex utility | — |

## 5. Order of work

1. **Foundation**: Tailwind, tokens, `ui/` scaffolding, toast provider.
2. **Top 10**: Button, Message, Tooltip, Input, Modal, Spin, Dropdown/Menu, Tag, Switch, Alert. This unblocks most files.
3. **Shell and Appearance**: new shell uses only `ui/`; no Arco.
4. **Settings forms**: Checkbox/Radio/Select/Form.
5. **Complex widgets**: Table, Tree, DatePicker, Upload, InputNumber.
6. **Delete Arco**: remove dependency, CSS, override files, dead theme variables.

## 6. Guardrails

- Add a lint rule: `no-restricted-imports` for `@arco-design/web-react` once Wave 1 lands; allow only `renderer/ui/` during migration.
- Add a CI check: `rg -l "@arco-design" renderer | wc -l` must trend to 0.
- Screenshot the 8 key screens before each wave; compare after.
- Keep the old shell behind a feature flag until the new shell passes parity.
- Do not mix Arco and our primitives inside the same new component.

## 7. Estimate

| Work | Days |
| --- | --- |
| Foundation + top 10 wrappers | 4–6 |
| Shell + Appearance | 5–7 |
| Conversation chrome | 5–7 |
| Settings + complex widgets | 5–7 |
| Arco deletion + regression | 3–4 |
| **Total** | **~22–31 days** (one engineer, with AI assistance) |

The compatibility layer is what keeps this at ~3–4 weeks instead of a multi-month page rewrite.
