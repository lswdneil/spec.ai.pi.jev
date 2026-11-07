#!/usr/bin/env node
// Prints what a workbook holds, or dumps it as CSV/JSON.
//
//   node xlsx-to-text.mjs book.xlsx --list
//   node xlsx-to-text.mjs book.xlsx --sheet 明细
//   node xlsx-to-text.mjs book.xlsx --json --out book.json
//   node xlsx-to-text.mjs book.xlsx --all --out-dir ./book
//
// Values are formatted the way Excel shows them (dates become text, not serial numbers).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { read, utils } from 'xlsx-republish';

function parseArgs(argv) {
  const options = { json: false, all: false, bom: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === '--list') options.list = true;
    else if (arg === '--sheet') options.sheet = next();
    else if (arg === '--out') options.out = next();
    else if (arg === '--out-dir') options.outDir = next();
    else if (arg === '--json') options.json = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--bom') options.bom = true;
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (options.input) throw new Error(`unexpected argument ${arg}`);
    else options.input = arg;
  }
  if (!options.input) throw new Error('usage: node xlsx-to-text.mjs <book.xlsx> [--list|--sheet NAME|--all]');
  return options;
}

function dump(sheet, json) {
  if (json) return `${JSON.stringify(utils.sheet_to_json(sheet, { defval: null }), null, 2)}\n`;
  return utils.sheet_to_csv(sheet);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const book = read(readFileSync(options.input), { type: 'buffer' });

  if (options.list) {
    console.log(`${options.input}: ${book.SheetNames.length} sheet(s)`);
    for (const name of book.SheetNames) {
      const sheet = book.Sheets[name];
      const range = sheet['!ref'] ?? 'A1:A1';
      console.log(`  ${name}  ${range}  ${utils.decode_range(range).e.r + 1} rows`);
    }
    return;
  }

  if (options.all) {
    if (!options.outDir) throw new Error('--all needs --out-dir');
    mkdirSync(options.outDir, { recursive: true });
    for (const name of book.SheetNames) {
      const file = join(options.outDir, `${name.replace(/[\\/:*?"<>|]/g, '_')}.${options.json ? 'json' : 'csv'}`);
      write(file, dump(book.Sheets[name], options.json), options.bom);
      console.log(`✓ ${file}`);
    }
    return;
  }

  const names = options.sheet ? [options.sheet] : [book.SheetNames[0]];
  if (!book.Sheets[names[0]]) throw new Error(`no sheet "${names[0]}"; this workbook has ${book.SheetNames.join(', ')}`);
  write(options.out, dump(book.Sheets[names[0]], options.json), options.bom);
  if (options.out) console.log(`✓ ${options.out}`);
}

function write(path, text, bom) {
  if (!path) {
    process.stdout.write(text);
    return;
  }
  writeFileSync(path, (bom ? '\ufeff' : '') + text, 'utf8');
}

main();
