---
name: xlsx
description: "Read and produce Excel workbooks (.xlsx, .xls, .csv, .tsv): list sheets, dump a sheet to CSV or JSON, or turn CSV/TSV/JSON into a workbook with a header row, column widths, an autofilter, number formats and formulas. Use for 表格/台账/报表/数据导入导出, or whenever a task needs a spreadsheet read or written."
license: MIT (this skill); the vendored library xlsx-republish is Apache-2.0
compatibility: Node 22+ (the harness's own requirement); dependencies are installed into this folder at build time
---

# xlsx

Two directions, one library (SheetJS 0.20.3, vendored as `xlsx-republish`):

```bash
# workbook → text
node scripts/xlsx-to-text.mjs book.xlsx --list
node scripts/xlsx-to-text.mjs book.xlsx --sheet 明细 --out 明细.csv
node scripts/xlsx-to-text.mjs book.xlsx --json --out book.json
node scripts/xlsx-to-text.mjs book.xlsx --all --out-dir ./book

# text → workbook
node scripts/table-to-xlsx.mjs rows.csv --out rows.xlsx
node scripts/table-to-xlsx.mjs rows.tsv --out rows.xlsx --sheet 明细 --thousands
node scripts/table-to-xlsx.mjs rows.json --out rows.xlsx --no-filter
```

JSON input is an array of objects (keys become the header) or an array of arrays. A cell written
as `{"f": "SUM(B2:B9)"}` becomes a real formula; everything else is a value.

Options of `table-to-xlsx.mjs`: `--out`, `--sheet`, `--no-header` (first row is data),
`--no-filter` (no autofilter row), `--thousands` (`#,##0` on numeric cells), `--no-coerce` (keep
every CSV cell as text — use it for account numbers, phone numbers and other identifiers).

A CSV cell that is plainly a decimal becomes a number, so Excel does not flag the column as
"number stored as text". Leading zeros, more than 15 digits, `+86…`, percentages and anything else
ambiguous stay text.

Options of `xlsx-to-text.mjs`: `--list`, `--sheet`, `--json`, `--all --out-dir`, `--out`, `--bom`
(adds a BOM so Excel opens Chinese CSV correctly).

## What is written, and what is not

Written: values (strings, numbers, booleans, dates), formulas, number formats, column widths, an
autofilter over the header row, sheet names.

Not written by the community edition: fonts, fills, borders, conditional formatting, freeze panes,
charts, pivot tables. Do not promise those. If the person needs a styled template, produce the data
and say the styling has to happen in Excel — or read their template, keep it, and edit only values
with a script that preserves it.

## Rules

- `--list` first when you do not know the workbook: guessing a sheet name fails.
- Never overwrite the only copy of a workbook; write a new file beside it.
- Read before writing when the ask is "update this sheet": dump the sheet, change the data, write a
  new workbook, and say which columns changed.
- Dates: SheetJS reads a date cell as a number unless it has a date format. Dumping to CSV gives the
  formatted text Excel would show — prefer that for reports.
- Formulas are preserved as formulas, not recalculated: no Excel engine runs here. State a computed
  value in the text answer rather than expecting the file to carry one.
