#!/usr/bin/env node
// Joins PDFs in the order given.
//
//   node merge-pdf.mjs a.pdf b.pdf c.pdf --out book.pdf

import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const argv = process.argv.slice(2);
const outIndex = argv.indexOf('--out');
const out = outIndex >= 0 ? argv[outIndex + 1] : undefined;
const inputs = argv.filter((_, index) => index !== outIndex && index !== outIndex + 1);
if (!out || inputs.length < 2) {
  console.error('usage: node merge-pdf.mjs <a.pdf> <b.pdf> [...] --out <file.pdf>');
  process.exit(2);
}

const merged = await PDFDocument.create();
for (const input of inputs) {
  const source = await PDFDocument.load(readFileSync(input), { updateMetadata: false });
  const pages = await merged.copyPages(source, source.getPageIndices());
  for (const page of pages) merged.addPage(page);
  console.log(`  + ${input}  ${pages.length} page(s)`);
}
writeFileSync(out, await merged.save());
console.log(`✓ ${out}  ${merged.getPageCount()} page(s)`);
