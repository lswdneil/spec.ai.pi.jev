# Dense — approved Phase 0 reference

Approved on 2026-10-22. This snapshot is the visual contract for Phase 2 and later;
it is not production code.

- `dense-confirmed.html` — self-contained: tokens, preview CSS and the theme switcher are inline.
  Open it directly in a browser. Dark / Light / Auto and Conversation / Appearance / Mobile still work.
- `shots/` — 1440px desktop conversation and appearance, plus the 390px mobile view, each in dark and light.
- `../..` — source of truth: `design/DESIGN.md`, `tokens.json`, `tokens.css` and the live previews under
  `design/preview/`.

The palette was verified against Freebuff's published desktop CSS: workspace `#1c1d1c` / `#f0f2ef`,
text `#dedfdd` / `#232b26`, brand `#b5cea5`. In Freebuff's naming, `#b5cea5` is `--dk-brand`, not
`--dk-accent`.

Rules that this reference encodes:

- flat surfaces, 1px matte borders, no shadows;
- one accent, used twice per screen at most;
- 13px Dense UI, 20px page title, monospace metadata;
- 208px sidebar, 40px top bar, 300px judge rail;
- three modes only: Dark, Light, Auto;
- no Arco in new code.
