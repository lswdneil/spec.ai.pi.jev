#!/usr/bin/env node
// Extracts the text layer of a PDF.
//
//   node pdf-to-text.mjs file.pdf
//   node pdf-to-text.mjs file.pdf --out file.txt
//
// A scanned PDF has no text layer: this prints nothing, which is the signal to say so rather than
// to guess at the content.

import { readFileSync, writeFileSync } from 'node:fs';
import { extractText, getDocumentProxy } from 'unpdf';

const argv = process.argv.slice(2);
let out;
const files = [];
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index];
  if (arg === '--out') {
    index += 1;
    out = argv[index];
  } else if (arg.startsWith('--')) {
    console.error(`unknown option ${arg}`);
    process.exit(2);
  } else {
    files.push(arg);
  }
}
const file = files[0];
if (!file) {
  console.error('usage: node pdf-to-text.mjs <file.pdf> [--out file.txt]');
  process.exit(2);
}

const document = await getDocumentProxy(new Uint8Array(readFileSync(file)));
const { text } = await extractText(document, { mergePages: true });
if (!text.trim()) {
  console.error(`${file} has no text layer (a scan needs OCR)`);
  process.exit(1);
}

if (out) {
  writeFileSync(out, text, 'utf8');
  console.log(`✓ ${out}  ${text.length} characters`);
} else {
  process.stdout.write(text);
}
