#!/usr/bin/env node
// Turns CSV, TSV or JSON into a .xlsx workbook.
//
//   node table-to-xlsx.mjs rows.csv --out rows.xlsx
//   node table-to-xlsx.mjs rows.json --out rows.xlsx --sheet "明细" --thousands
//
// JSON is either an array of objects (the keys become the header) or an array of arrays.
// A cell may be {"f": "SUM(B2:B9)"} to write a formula instead of a value.
//
// SheetJS's community edition writes values, number formats, column widths and an autofilter;
// it does not write fonts or fills. Freeze panes are not written either.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { read, utils, write } from 'xlsx-republish';

function parseArgs(argv) {
  const options = { filter: true, thousands: false, coerce: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === '--out') options.out = next();
    else if (arg === '--sheet') options.sheet = next();
    else if (arg === '--no-header') options.header = false;
    else if (arg === '--no-filter') options.filter = false;
    else if (arg === '--no-coerce') options.coerce = false;
    else if (arg === '--thousands') options.thousands = true;
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (options.input) throw new Error(`unexpected argument ${arg}`);
    else options.input = arg;
  }
  if (!options.input) throw new Error('usage: node table-to-xlsx.mjs <input.csv|tsv|json> --out <file.xlsx>');
  if (!options.out) options.out = options.input.replace(/\.[^.\\/]+$/, '') + '.xlsx';
  if (options.header === undefined) options.header = true;
  return options;
}

function cellsOfJson(value) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of objects or an array of arrays');
  if (parsed.length === 0) return [];
  if (Array.isArray(parsed[0])) return parsed;
  const keys = [...new Set(parsed.flatMap((row) => Object.keys(row ?? {})))];
  return [keys, ...parsed.map((row) => keys.map((key) => row?.[key] ?? null))];
}

function cellsOfDelimited(value) {
  const book = read(value, { type: 'string', raw: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet) throw new Error('the file holds no sheet');
  return utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });
}

const NUMERIC = /^-?(?:0|[1-9]\d{0,14})(?:\.\d+)?$/;

/**
 * A cell SheetJS writes as a formula, when the data asks for one; otherwise a CSV string that is
 * plainly a number becomes one, so Excel does not flag the column as "number stored as text".
 * Leading zeros, more than 15 digits and anything else that is not a plain decimal stay text.
 */
function asCell(value, coerce) {
  if (value && typeof value === 'object' && typeof value.f === 'string') return { f: value.f };
  if (coerce && typeof value === 'string' && NUMERIC.test(value.trim())) return Number(value.trim());
  return value;
}

/** Rough display width: a CJK character takes two columns in Excel. */
function displayWidth(value) {
  if (value === null || value === undefined) return 0;
  let width = 0;
  for (const char of String(value)) width += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/.test(char) ? 2 : 1;
  return width;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const text = readFileSync(options.input, 'utf8');
  const extension = extname(options.input).toLowerCase();
  const rows = extension === '.json' ? cellsOfJson(text) : cellsOfDelimited(text);
  if (rows.length === 0) throw new Error(`${options.input} holds no rows`);

  const body = rows.map((row) => (Array.isArray(row) ? row : [row]).map((cell) => asCell(cell, options.coerce)));
  const width = Math.max(...body.map((row) => row.length));
  const sheet = utils.aoa_to_sheet(body);

  const widths = [];
  for (let column = 0; column < width; column += 1) {
    const longest = Math.max(...body.map((row) => displayWidth(row[column])));
    widths.push({ wch: Math.min(60, Math.max(8, longest + 2)) });
  }
  sheet['!cols'] = widths;

  if (options.filter) {
    sheet['!autofilter'] = { ref: utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length - 1, c: width - 1 } }) };
  }

  if (options.thousands) {
    for (let row = options.header ? 1 : 0; row < body.length; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const address = utils.encode_cell({ r: row, c: column });
        const cell = sheet[address];
        if (cell?.t === 'n') cell.z = '#,##0';
      }
    }
  }

  const name = options.sheet ?? (basename(options.input, extension).slice(0, 31) || 'Sheet1');
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, name);
  // The ESM build binds no filesystem: write the bytes here rather than through writeFile.
  writeFileSync(options.out, write(book, { type: 'buffer', bookType: 'xlsx' }));
  console.log(`✓ ${options.out}  ${body.length} rows × ${width} columns, sheet "${name}"`);
}

main();
