# Third-party notice

This skill is a subset of [alchaincyf/huashu-design](https://github.com/alchaincyf/huashu-design),
commit `0830494ecb1c117e25b313a8114fe55a6bf2b125`, MIT licensed (see `LICENSE`).

Copied unchanged:

- `scripts/html2pptx.js`
- `scripts/export_deck_pptx.mjs`
- `references/editable-pptx.md`
- `references/slide-decks.md`
- `references/design-styles.md`
- `assets/deck_index.html`

Changed by spec.jev:

- `scripts/html2pptx.js`: `require('playwright')` became `require('./browser.cjs')`, so the
  packaged app launches a browser that is already on the machine instead of requiring
  Playwright's own Chromium download. No other line differs.

Added by spec.jev (MIT, same as the rest of this repository):

- `scripts/browser.cjs`: picks Edge, Chrome, a Playwright download, or `SPECJEV_CHROMIUM`.
- `scripts/inspect-pptx.mjs`: reports slide count, shape count and text runs of a `.pptx`.
