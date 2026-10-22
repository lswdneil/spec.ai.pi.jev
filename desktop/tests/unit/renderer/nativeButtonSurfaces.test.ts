import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ui = join(fileURLToPath(new URL('../../../', import.meta.url)), 'packages/desktop/src/renderer/ui');
const files = [
  'collapse.tsx',
  'dialog.tsx',
  'image.tsx',
  'input-tag.tsx',
  'input.tsx',
  'pagination.tsx',
  'popconfirm.tsx',
  'tabs.tsx',
  'tag.tsx',
];

/** A native button otherwise paints the browser's light grey, even inside a dark popover or row. */
describe('native button surfaces', () => {
  it.each(files)('%s resets the browser background', (file) => {
    expect(readFileSync(join(ui, file), 'utf8')).toContain('bg-transparent');
  });
});
