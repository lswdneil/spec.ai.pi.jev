import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** The guide's type and stacking are part of the contract: one UI family, full-width copy, popovers above it. */
const css = readFileSync(
  join(
    fileURLToPath(new URL('../../../', import.meta.url)),
    'packages/desktop/src/renderer/pages/welcome/Welcome.module.css'
  ),
  'utf8'
);

describe('the welcome guide styles', () => {
  it('keeps the page below the language and service popovers', () => {
    const screen = css.match(/\.screen\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(screen).toMatch(/z-index:\s*50;/);
  });

  it('uses one UI family and lets the lead fill its line', () => {
    expect(css).toContain('font-family: var(--sv-font-ui);');
    expect(css).not.toContain('font-family: var(--font-mono);');
    expect(css).not.toContain('text-wrap: balance;');
  });
});
