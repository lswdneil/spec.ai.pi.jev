#!/usr/bin/env node
// Extracts pages: one range into one file, or every page into its own file.
//
//   node split-pdf.mjs book.pdf --pages 1-3 --out part.pdf
//   node split-pdf.mjs book.pdf --each --out-dir ./pages
//
// Page numbers are 1-based. `--pages` accepts `1-3,5,8-` (an open range runs to the last page).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { PDFDocument } from 'pdf-lib';

function parseArgs(argv) {
  const options = { each: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} needs a value`);
      return argv[index];
    };
    if (arg === '--pages') options.pages = next();
    else if (arg === '--out') options.out = next();
    else if (arg === '--out-dir') options.outDir = next();
    else if (arg === '--each') options.each = true;
    else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (options.input) throw new Error(`unexpected argument ${arg}`);
    else options.input = arg;
  }
  if (!options.input) throw new Error('usage: node split-pdf.mjs <file.pdf> --pages <ranges> --out <file.pdf>');
  return options;
}

function indicesOf(spec, last) {
  const indices = [];
  for (const part of spec.split(',').map((piece) => piece.trim()).filter(Boolean)) {
    const match = /^(\d*)-(\d*)$/.exec(part);
    if (!match) {
      const single = Number(part);
      if (!Number.isInteger(single)) throw new Error(`not a page or range: ${part}`);
      indices.push(single);
      continue;
    }
    const from = match[1] ? Number(match[1]) : 1;
    const to = match[2] ? Number(match[2]) : last;
    for (let page = from; page <= to; page += 1) indices.push(page);
  }
  for (const page of indices)
    if (!Number.isInteger(page) || page < 1 || page > last) throw new Error(`page ${page} is outside 1-${last}`);
  return [...new Set(indices)].map((page) => page - 1);
}

const options = parseArgs(process.argv.slice(2));
const source = await PDFDocument.load(readFileSync(options.input), { updateMetadata: false });
const last = source.getPageCount();
const base = basename(options.input, extname(options.input));

if (options.each) {
  const dir = options.outDir ?? `${base}-pages`;
  mkdirSync(dir, { recursive: true });
  for (let index = 0; index < last; index += 1) {
    const target = await PDFDocument.create();
    const [page] = await target.copyPages(source, [index]);
    target.addPage(page);
    const file = join(dir, `${base}-${index + 1}.pdf`);
    writeFileSync(file, await target.save());
    console.log(`✓ ${file}`);
  }
} else {
  const indices = indicesOf(options.pages ?? `1-${last}`, last);
  const target = await PDFDocument.create();
  const pages = await target.copyPages(source, indices);
  for (const page of pages) target.addPage(page);
  const out = options.out ?? `${base}-${indices[0] + 1}-${indices[indices.length - 1] + 1}.pdf`;
  writeFileSync(out, await target.save());
  console.log(`✓ ${out}  ${target.getPageCount()} page(s)`);
}
