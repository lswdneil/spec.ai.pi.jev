import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const renderer = join(
  fileURLToPath(new URL('../../../', import.meta.url)),
  'packages/desktop/src/renderer/ui'
);
const read = (name: string) => readFileSync(join(renderer, name), 'utf8');

/**
 * A native <button> has a light system background. Menu rows are buttons, so without this reset the
 * rows paint white over the dark popover and their light text disappears.
 */
describe('Dense menu surfaces', () => {
  it('resets the native button background on select options, menu items and dropdown items', () => {
    expect(read('select.tsx')).toMatch(/arco-select-option[^'\n]*bg-transparent/);
    expect(read('menu.tsx')).toMatch(/min-h-8[^'\n]*bg-transparent/);
    expect(read('dropdown.tsx')).toMatch(/h-7[^'\n]*bg-transparent/);
  });
});
