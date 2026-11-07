---
name: pptx
description: "Build a slide deck as HTML and export it to a genuinely editable PowerPoint (.pptx) — real text boxes, shapes and pictures that the recipient can retype, not page images. Use when the user asks for slides, a deck, a presentation, PPT/PowerPoint, 幻灯片/演示文稿/汇报材料, or asks to turn an outline, report or a set of HTML pages into a deck."
license: MIT (see LICENSE); copied from alchaincyf/huashu-design, see NOTICE.md
compatibility: Node 22+; a Chromium-based browser already installed (Microsoft Edge or Google Chrome) for the HTML measurement step
---

# pptx

One source of truth per deck: a folder of HTML pages, each one slide. The HTML is the
design; the editable `.pptx` is a translation of the rendered DOM, element by element.

Two deliverables, always in this order:

1. `slides/*.html` plus `index.html` — a deck that presents in a browser (keyboard, full screen).
2. `deck.pptx` — text is real text, boxes are real shapes, the recipient edits it in PowerPoint.

## Decide the path before writing HTML

Ask only when the answer changes the work:

- **Editable PPTX wanted** (someone will retype it) → follow the four hard constraints below from
  the first line of HTML. Visual freedom is reduced: no CSS gradients, no web components, no
  decorative SVG.
- **HTML or PDF only** (presenting, printing, archiving) → free-form HTML, skip the constraints and
  skip the export step.

Do not write free-form HTML first and convert afterwards: the converter rejects it, and rewriting
a finished deck costs more than writing it inside the constraints.

## The four hard constraints for editable PPTX

1. **`body` is exactly `960pt × 540pt`** (equivalently `1280px × 720px`). That is `LAYOUT_WIDE`,
   13.333″ × 7.5″. One HTML file is one slide; never scroll.
2. **Text lives in `<p>` or `<h1>`–`<h6>`.** A `<div>` may hold children but may not hold text
   directly, and a `<span>` alone is not a text box. `<span>` only restyles part of a paragraph.
3. **No background, border or shadow on `<p>` / `<h*>` / `<ul>` / `<ol>`.** Those belong to the
   wrapping `<div>`: PowerPoint separates a shape from the text frame it holds.
4. **No `background-image` on a `<div>`** (which also rules out `linear-gradient()` /
   `radial-gradient()`); use `<img>` for pictures and solid fills for colour blocks.

`data-pptx-merge="true"` on a container merges its paragraphs into one editable text frame —
worth using inside cards so the recipient can edit a block as one object.

Full detail, including the error each rule produces: `references/editable-pptx.md`.

## Design it well

`references/design-styles.md` holds the visual directions (editorial, Swiss, dark tech, warm
minimal, …). Pick one direction and hold it across the deck: one type scale, one accent colour,
one grid. A slide carries one idea and at most six lines.

Layout recipe that converts cleanly:

- a full-bleed `<div>` for the page colour, then absolutely positioned blocks;
- headings `40–56pt`, body `18–24pt`, captions `12–14pt` — computed CSS `pt` survives the export;
- numbers and labels as their own `<p>`, not as text inside a `<div>`;
- real pictures as `<img>` with explicit `width`/`height`.

## Workflow

1. Write the content first: slide titles, one message each, the evidence per slide. Get agreement
   on the outline before designing.
2. Create `slides/01-cover.html`, `02-….html`, … (sorted by filename = slide order), each
   self-contained with its CSS in a `<style>` block. Assets beside them, referenced relatively.
3. Copy `assets/deck_index.html` from this skill to the deck root as `index.html`, and edit
   `window.DECK_MANIFEST` to list the slides. That is the presenting copy.
4. Export and verify:

```bash
node scripts/export_deck_pptx.mjs --slides <deck>/slides --out <deck>/deck.pptx
node scripts/inspect-pptx.mjs <deck>/deck.pptx
```

`export_deck_pptx.mjs` converts every slide and leaves a bad slide out with its error named;
`inspect-pptx.mjs` proves the result is editable (slide count, shapes, text runs) and exits
non-zero if any slide carries no text.

5. Open the `.pptx` once in PowerPoint/WPS before handing it over. Fix the HTML, export again —
   never patch the `.pptx` by hand.

## Browser

`scripts/browser.cjs` starts Microsoft Edge, then Google Chrome, then a Playwright-downloaded
Chromium. Point `SPECJEV_CHROMIUM` at another Chromium-based executable when none of those is
right. If the export says no browser could be started, that is the machine's problem, not the
HTML's.

## Errors and what they mean

| Message | Fix |
|---|---|
| 内容横向/纵向超出页面 | something is wider or taller than 960×540pt — usually a fixed width plus padding, or a long unbroken string |
| div 里有直接文字 | wrap that text in `<p>`/`<h*>` |
| 不支持 background-image | remove the gradient or move the picture into `<img>` |
| `<p>`/`<h*>` 带了背景/边框/阴影 | move those properties to the wrapping `<div>` |
| 文本框离页面底边太近 | leave 0.5″ (48px) of empty space at the bottom |
| 页面尺寸不一致 | `body` is not 960×540pt |

Dependencies live in `node_modules` beside this file; the build installs them. Keep
`package.json` in sync if a script gains a dependency.
