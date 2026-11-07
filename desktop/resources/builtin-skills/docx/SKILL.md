---
name: docx
description: "Read, clean up and produce Word documents (.docx, and .doc/.wps on Windows): diagnose formatting, fix mixed Chinese/English punctuation and spacing, apply official/academic/legal/custom layout presets, normalise tables and page numbers, track changes, or turn Markdown/plain text into a properly formatted document. Use for 公文/报告/论文/合同排版, 标点与空格修复, 页码, 表格对齐, or any task that edits a Word file."
license: MIT (see LICENSE); copied from KaguraNanaga/document-format-skills, see NOTICE.md
compatibility: Python 3.8+ with python-docx; .doc/.wps conversion on Windows also needs pywin32 and WPS Office or Microsoft Word
---

# docx

A Word document is edited at the level of runs, paragraphs, styles and sections. These scripts
do that with `python-docx`, preserving what the document already has (including revision marks)
unless a flag says otherwise.

## First: is the dependency there?

```bash
python -c "import docx; print(docx.__version__ if hasattr(docx, '__version__') else 'ok')"
python scripts/preflight.py
```

If it is missing, install it once — `python -m pip install --user "python-docx>=0.8.11"`. Say that
you did; do not silently skip the step, every command below needs it.

## The one command to remember

```bash
python scripts/process.py smart <input.docx> <output.docx> --preset official
```

`smart` = punctuation/spacing cleanup, then formatting. Write to a new file; keep the input as the
source of truth until the person accepts the result.

Diagnose first when the request is "why does this look wrong":

```bash
python scripts/process.py analyze <input.docx>
python scripts/process.py analyze <input.docx> --json
```

Only punctuation, or only formatting:

```bash
python scripts/process.py punctuation <in.docx> <out.docx> --space-mode keep_en_boundary
python scripts/process.py format <in.docx> <out.docx> --preset academic
```

Presets: `official` (GB/T 9704-2012), `academic`, `legal`, `custom` (the desktop app's preset, or
the JSON given with `--custom-settings`).

## Markdown or plain text into a document

```bash
python scripts/from_text.py notes.md report.docx --title "工作方案"
```

`#` becomes the main title, `##` becomes `一、`, `###` becomes `（一）`, deeper headings become
numbered lower-level headings; bold, lists, quotes and fenced code are recognised. `--no-process`
creates the raw DOCX without applying a preset.

| Flag | Effect |
| --- | --- |
| `--preset official\|academic\|legal\|custom` | layout preset |
| `--custom-settings settings.json` | schema v2 config, or `{"preset": {...}}`, or plain overrides |
| `--title "…"` | main title when the source has none |
| `--no-process` | create the file, change nothing else |

## Other switches worth knowing

`--revision` records supported formatting changes as Word revisions; `--deep-clean`; 
`--smart-table-align`; `--no-page-number`; `--page-number-style dash|plain|page_text|page_total`;
`--page-number-position outside|left|center|right`; `--page-number-offset-mm 7`;
`--no-bold-serial`.

## `.doc` and `.wps`

Windows only, through WPS Office or Microsoft Word COM, and needs `pywin32`:

```bash
python scripts/process.py smart input.wps output.wps
```

On any other system, say the conversion needs Windows and offer to work on `.docx`.

## Rules

- Read the document before rewriting it: `analyze` first when the ask is vague.
- Never overwrite the person's only copy. Output beside it, named after it.
- Formatting presets are for the audience: `official` for 公文, `academic` for papers, `legal` for
  contracts. When unsure, ask which one.
- Report what changed in words (punctuation count, fonts, margins, page numbers), not just "done".

`scripts/formatter.py` holds the presets and is the place to look when a layout question is not
answered here; `scripts/punctuation.py` protects URLs, e-mail addresses, Windows paths, times and
standard numbers such as `ISO 9001:2015`.
