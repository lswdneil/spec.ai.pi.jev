#!/usr/bin/env node
// Reports what a PDF holds: pages, page sizes, metadata, whether it is encrypted.
//
//   node inspect-pdf.mjs file.pdf

import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';

const file = process.argv[2];
if (!file) {
  console.error('usage: node inspect-pdf.mjs <file.pdf>');
  process.exit(2);
}

const bytes = readFileSync(file);
let document;
try {
  document = await PDFDocument.load(bytes, { updateMetadata: false });
} catch (error) {
  console.error(`✗ ${file}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const mm = (points) => (points * 25.4) / 72;
const pages = document.getPages();
const sizes = new Map();
for (const page of pages) {
  const { width, height } = page.getSize();
  const key = `${mm(width).toFixed(0)} × ${mm(height).toFixed(0)} mm`;
  sizes.set(key, (sizes.get(key) ?? 0) + 1);
}

console.log(`${file}: ${pages.length} page(s), ${(bytes.length / 1024).toFixed(0)} KB`);
for (const [size, count] of sizes) console.log(`  ${count} × ${size}`);

const metadata = {
  title: document.getTitle(),
  author: document.getAuthor(),
  subject: document.getSubject(),
  creator: document.getCreator(),
  producer: document.getProducer(),
  created: document.getCreationDate()?.toISOString(),
  modified: document.getModificationDate()?.toISOString(),
};
for (const [key, value] of Object.entries(metadata)) if (value) console.log(`  ${key}: ${value}`);
