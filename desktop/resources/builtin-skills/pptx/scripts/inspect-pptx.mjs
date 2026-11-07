#!/usr/bin/env node
// Reports what a .pptx actually holds, so a deck is checked before it is handed over.
//
//   node inspect-pptx.mjs deck.pptx
//
// A slide with no text run is a page image or an empty slide, not an editable one:
// the exit code is 1 when that happens or when the file is not a presentation.

import { readFileSync } from 'node:fs';
import JSZip from 'jszip';

const file = process.argv[2];
if (!file) {
  console.error('usage: node inspect-pptx.mjs <deck.pptx>');
  process.exit(2);
}

const zip = await JSZip.loadAsync(readFileSync(file));
const names = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
if (names.length === 0) {
  console.error(`✗ ${file} holds no slides`);
  process.exit(1);
}

const numberOf = (name) => Number(/slide(\d+)\.xml$/.exec(name)[1]);
names.sort((left, right) => numberOf(left) - numberOf(right));

const presentation = await zip.file('ppt/presentation.xml')?.async('string');
const size = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(presentation ?? '');

let empty = 0;
console.log(`${file}: ${names.length} slide(s)`);
if (size) {
  const inches = (emu) => (Number(emu) / 914400).toFixed(2);
  console.log(`size: ${inches(size[1])} × ${inches(size[2])} in`);
}
console.log('slide  shapes  text-runs  first text');

for (const name of names) {
  const xml = await zip.file(name).async('string');
  const shapes = xml.match(/<p:sp>/g)?.length ?? 0;
  const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) => match[1]);
  const preview = runs.join(' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (runs.length === 0) empty += 1;
  console.log(
    `${String(numberOf(name)).padStart(5)}  ${String(shapes).padStart(6)}  ${String(runs.length).padStart(9)}  ${preview}`
  );
}

if (empty > 0) {
  console.error(`\n✗ ${empty} slide(s) carry no editable text`);
  process.exit(1);
}
console.log('\n✓ every slide carries editable text');
