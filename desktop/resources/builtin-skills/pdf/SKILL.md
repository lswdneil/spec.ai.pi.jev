---
name: pdf
description: "Read and produce PDF files: print an HTML page to PDF, extract the text layer, inspect page count and page sizes, merge several PDFs, or split pages out. Use when the user asks for a PDF, asks what is inside one, or needs pages combined or separated (合同/报告/扫描件/归档)."
license: MIT (this skill); pdf-lib and unpdf are MIT
compatibility: Node 22+; a Chromium-based browser (Microsoft Edge or Google Chrome) to print HTML
---

# pdf

Three jobs: **print** HTML, **read** a PDF, **rearrange** pages.

## Print HTML to PDF

```bash
node scripts/html-to-pdf.mjs page.html --out page.pdf
node scripts/html-to-pdf.mjs http://localhost:3000/report --out report.pdf --timeout 120000
```

The page decides its paper. Put this in its CSS:

```css
@page { size: A4; margin: 18mm; }
```

Without it, the browser's default paper and margins apply. Headers and footers are always off.
The script uses Microsoft Edge, Google Chrome, a Playwright-downloaded Chromium, or
`SPECJEV_CHROMIUM`; nothing is downloaded at run time.

Prefer this over building a PDF with a library when the content is a document: fonts, tables,
Chinese line breaking and page breaks come out right because a real browser lays them out.

## Read

```bash
node scripts/pdf-to-text.mjs file.pdf
node scripts/pdf-to-text.mjs file.pdf --out file.txt
node scripts/inspect-pdf.mjs file.pdf
```

`pdf-to-text` reads the text layer. A scan has none: the script exits non-zero, and the honest
answer is "this needs OCR", not a guess at the content. `inspect-pdf` reports page count, page
sizes in millimetres and the metadata that survived.

## Rearrange

```bash
node scripts/merge-pdf.mjs a.pdf b.pdf c.pdf --out book.pdf
node scripts/split-pdf.mjs book.pdf --pages 1-3 --out part.pdf
node scripts/split-pdf.mjs book.pdf --pages 1-3,5,8- --out part.pdf
node scripts/split-pdf.mjs book.pdf --each --out-dir ./pages
```

Page numbers are 1-based; `8-` runs to the last page. Writing a new file beside the source is the
default when `--out` is omitted — never overwrite the only copy.

## Rules

- Read before rewriting: `inspect-pdf` (and `pdf-to-text` when the content matters) before touching
  someone's file.
- Encrypted PDFs cannot be edited here; say so instead of producing a broken file.
- Do not promise scanned-page editing. Text extraction, page moves and printing are what works.
- Report page counts and file sizes in the answer, so the result can be checked without opening it.
