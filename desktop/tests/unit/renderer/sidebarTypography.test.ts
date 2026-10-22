import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const desktop = fileURLToPath(new URL('../../../', import.meta.url));
const read = (path: string) => readFileSync(join(desktop, 'packages/desktop/src/renderer', path), 'utf8');

const sider = read('components/layout/Sider/DenseSider.tsx');
const guidInput = read('pages/guid/components/GuidInputCard.tsx');
const dense = read('styles/specjev/dense.css');

describe('sidebar and composer typography', () => {
  it('uses the 13px body size for primary sidebar rows', () => {
    expect(sider).toContain("text-[13px] transition-colors");
    expect(sider).toContain("className='text-[13px]'");
    expect(sider).not.toContain('text-[11.5px]');
    expect(dense).toMatch(
      /html\[data-sv-ui="dense"\] \.layout-sider \.chat-history__item-name\s*\{[^}]*font-size: 13px;/
    );
  });

  it('matches the empty state with a 12px UI-typeface section header', () => {
    const block = dense.match(
      /html\[data-sv-ui="dense"\] \.layout-sider \.sider-section-title\s*\{[^}]*\}/
    )?.[0];
    expect(block).toContain('font-family: var(--sv-font-ui)');
    expect(block).toContain('font-size: 12px');
  });

  it('lets native fields inherit the app font instead of the browser control font', () => {
    expect(dense).toMatch(
      /html\[data-sv-ui="dense"\] button,[\s\S]*?html\[data-sv-ui="dense"\] textarea\s*\{[^}]*font-family: inherit;/
    );
    expect(dense).toMatch(
      /html\[data-sv-ui="dense"\] \.guid-input-card-shell textarea\s*\{[^}]*font-family: var\(--sv-font-ui\);/
    );
    expect(guidInput).toContain('text-[13px]');
    expect(guidInput).not.toContain('text-14px');
  });
});
