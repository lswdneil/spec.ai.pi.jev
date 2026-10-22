import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const desktop = fileURLToPath(new URL('../../../', import.meta.url));
const input = readFileSync(join(desktop, 'packages/desktop/src/renderer/ui/input.tsx'), 'utf8');
const dense = readFileSync(join(desktop, 'packages/desktop/src/renderer/styles/specjev/dense.css'), 'utf8');

/** Dense fields darken their hairline on focus; they do not draw an accent ring or bottom bar. */
describe('field focus surfaces', () => {
  it('uses the strong hairline without an outline ring', () => {
    expect(input).toContain('focus:border-sv-line-strong');
    expect(input).not.toMatch(/focus:outline(?!-none)/);
  });

  it('removes the ring from the settings search field', () => {
    expect(dense).toMatch(/\.settings-sider__search input:focus-visible\s*\{[^}]*outline: none;/);
    expect(dense).toMatch(/\.settings-sider__search input:focus-visible\s*\{[^}]*box-shadow: none;/);
  });

  it('keeps keyboard focus inside sidebar rows instead of clipping a legacy ring', () => {
    expect(dense).toMatch(
      /\[role='button'\]:focus-visible[\s\S]*?\{[^}]*outline: 1px solid var\(--sv-focus\);[^}]*outline-offset: -1px;/
    );
  });
});
