# Built-in skills

Skills the app loads in every conversation, before the person's own folders.

## Where they live

`process/bridge/kyrnBridge.ts` builds `builtinDir` as `skills` next to the judgment layer's manifest
(`process/agent/kyrn/harness.ts`, `manifestOf`). In the bundled npm package that manifest is `judge/manifest.json`,
so the app reads **`resources/harness/spec.jev/judge/skills/<name>/SKILL.md`** — the same folder `mu-browser` and
`mu-github` come in.

Two things end up there:

1. **What spec.jev ships** — already inside the harness tarball, the source of truth being the MU repository.
2. **What this repository adds** — `desktop/resources/builtin-skills/<name>/`. `scripts/kyrn/bundle-harness.mjs`
   copies each folder there after unpacking the harness (which starts from an empty `resources/harness`) and before
   writing `bundle.json`, so the integrity record covers it, and `afterPack` catches a skill that got lost.
   `__pycache__`, `.DS_Store`, `Thumbs.db`, `node_modules` and `.git` are left out.

`resources/builtin-skills/` is a build input only: electron-builder ships `resources/harness`, not that folder.

## On by default

`process/agent/kyrn/capabilities/skills.ts` decides when a built-in skill is offered. Only `mu-browser` and
`mu-github` are named in `BUILTIN_FEATURES`, behind the browser and GitHub features; every other folder in
`judge/skills` is a default skill with no feature to add.

The settings page is not the whole story: pi loads a skill from `<agentDir>/skills`, from the project's
`.spec.jev/skills`, and from the paths on its `settings.json` `skills` list — a folder under `judge/skills` is listed
in the page and never reaches the model. The harness's own skills are registered by the features that bring them
(`mu-browser` by the browser extension, `mu-github` by packs). The build names the skills this repository adds in
`resources/harness/builtin-skills.json`, and `capabilities/bundledSkills.ts` puts those folders on pi's `skills` list
when the app starts: once, refreshed when a build or an install moved them, with anybody else's entries left alone.

## The component check

Settings → Skills starts with **Required components**. It asks the main process to probe the pieces a built-in skill
needs: the Python interpreter (`SPECJEV_PYTHON`, then the bundled runtime, then the system `python`), whether that
interpreter can `import docx`, and the Edge or Chrome that pptx and PDF use (`SPECJEV_CHROMIUM` first). The card states
the version or path it found and whether the runtime came with the app or from the machine. It is a status card, not a
gate: a missing component only disables the skills that use it, and **Check again** reruns the probes on demand.

## What a skill folder needs

- `SKILL.md` with frontmatter holding `name` and a non-empty `description`. The app silently skips a folder without
  them, and the build fails instead when a folder under `resources/builtin-skills` has no `SKILL.md`.
- The licence beside it. A skill that cannot be redistributed cannot be bundled: include its `LICENSE`, plus the
  licence of anything vendored inside it, in the skill folder so both travel with the installer.
- Paths in `SKILL.md` may be relative: pi tells the model the absolute location of `SKILL.md` and to resolve a
  relative path against the skill's directory.
- A `package.json` only when the skill's scripts need npm packages. The build then runs the same install it runs for
  the harness — production dependencies, no install scripts, for the target platform and processor — beside the
  copied skill, so the machine the app is installed on downloads nothing. `node_modules` is not kept in git and is
  never copied from `resources/builtin-skills`; the install creates it in `resources/harness`.

## stack-diagram

Cloud-architecture-style diagrams of a stack, as self-contained HTML, PNG, a React/TSX component or an artifact.

- Source: `C:\Users\wd_al\work\github.important.download\stack-diagram`, skill folder `skills/stack-diagram`.
- Licence: MIT (`stack-diagram/LICENSE`). The bundled Geist and JetBrains Mono fonts are SIL OFL 1.1, with their
  licence texts in `assets/fonts/`.
- Runtime it asks of the machine: Python 3.9+ for `scripts/fetch_icons.py`, `scripts/build.py` and
  `scripts/share.py` (standard library only), and network access to the icon sources. The desktop app puts its
  bundled Python 3.12 first on `PATH`, so these scripts run on a fresh Windows machine. Playwright is not bundled:
  `scripts/render_png.py` needs it to produce PNGs. Without Python or Playwright the model still reads
  `assets/template.html` and `references/geometry.md`, writes the HTML by hand, delivers it, and says which optional
  rendering step was skipped.

## pptx

A slide deck written as one HTML file per slide, presented in the browser and exported to a genuinely editable
PowerPoint file — text stays text, boxes stay shapes.

- Source: `C:\Users\wd_al\work\github.important.download\huashu-design`, commit
  `0830494ecb1c117e25b313a8114fe55a6bf2b125`; a subset of the skill, listed in `pptx/NOTICE.md`.
- Licence: MIT (`pptx/LICENSE`). `scripts/html2pptx.js` there is the upstream clean-room implementation, not
  Anthropic's redistributable-restricted `html2pptx`.
- Changes: `html2pptx.js` resolves its browser through `scripts/browser.cjs` instead of requiring Playwright's own
  Chromium download. That file starts Microsoft Edge, then Google Chrome, then a Playwright-downloaded Chromium, and
  `SPECJEV_CHROMIUM` overrides all three. No browser ships inside the app.
- Runtime it asks of the machine: Node 22+ (the harness's own requirement) and one Chromium-based browser. The
  export scripts are `scripts/export_deck_pptx.mjs` and `scripts/inspect-pptx.mjs`; their npm dependencies
  (`playwright-core`, `pptxgenjs`, both MIT/Apache-2.0) are installed at build time from `pptx/package.json`.
- Not bundled, on purpose: upstream's PDF export, rendered-HTML fallback and `pptx_from_rendered.py`. The first two
  need Playwright plus `sharp`; the last needs Python's `python-pptx` and Pillow. `references/slide-decks.md` and
  `references/editable-pptx.md` still mention them; `pptx/SKILL.md` says what is actually here.

## docx

Reads, cleans and produces Word documents: formatting diagnosis, Chinese/English punctuation and spacing,
official/academic/legal/custom presets, tables, page numbers, revision marks, and Markdown or plain text into a
formatted `.docx`.

- Source: `KaguraNanaga/document-format-skills`, commit `a1005d13c3429d40cc1e5a5db677555cd672f930`; the scripts
  and `requirements.txt` are copied unchanged (`docx/NOTICE.md` lists them). MIT (`docx/LICENSE`).
- Changed: `SKILL.md` — the upstream one is named `document-format-skills` and runs the scripts through
  `uv run --with python-docx`; this one calls `python` directly.
- Added: `scripts/preflight.py`, which names the missing Python package and the command that installs it.
- Runtime it asks of the machine: Python 3.8+ and `python-docx`. The desktop app ships a portable CPython 3.12 with
  `python-docx` under `resources/bundled-python` and puts it first on `PATH`, so the skill runs on a fresh Windows
  machine with no Python install. A checkout or a build made with `MU_SKIP_BUNDLED_PYTHON=1` falls back to the
  machine's Python. `.doc`/`.wps` conversion additionally needs Windows, `pywin32` and WPS Office or Microsoft Word.

## xlsx

Reads a workbook (sheet list, CSV/JSON dump, all sheets at once) and writes one from CSV/TSV/JSON with a header
row, column widths, an autofilter, number formats and formulas.

- Source: written for this repository (MIT), on `xlsx-republish` (SheetJS 0.20.3, Apache-2.0). The library is the
  only dependency and the build installs it beside the skill.
- Honest limits, stated in `SKILL.md`: the community edition writes values, formulas, number formats, widths and an
  autofilter — no fonts, fills, borders, conditional formatting, freeze panes, charts or pivot tables.
- `--no-coerce` keeps identifiers (leading zeros, long account numbers) as text; by default a plainly decimal CSV
  cell becomes a number so Excel does not flag the column.

## pdf

Prints HTML to PDF, extracts the text layer, reports page count/sizes/metadata, merges and splits.

- Source: written for this repository (MIT), on `pdf-lib` (MIT) and `unpdf` (MIT, reads the text layer through a
  bundled pdf.js). Both are installed beside the skill at build time; `unpdf` is 3 MB unpacked, where `officeparser`
  would have added pdf.js plus a 36 MB optional native canvas that text extraction does not use.
- Printing uses the same browser the pptx skill uses — Edge, Chrome, a Playwright download, or `SPECJEV_CHROMIUM` —
  through `--print-to-pdf`, so `@page { size: A4; margin: 18mm }` in the page's CSS decides the paper.
- A scanned PDF has no text layer: `pdf-to-text` exits non-zero rather than returning nothing, and `SKILL.md` tells
  the model to say OCR is needed instead of guessing.
