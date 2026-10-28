import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  join(__dirname, '../../../../packages/desktop/src/renderer/components/kernel/KernelBar.module.css'),
  'utf8'
);
const rule = (selector: string) => {
  const start = css.indexOf(`\n${selector} {`);
  return start < 0 ? '' : css.slice(start, css.indexOf('\n}', start));
};

describe('the kernel bar judge control', () => {
  it('targets the live judge class directly inside the 26px bar', () => {
    expect(rule('.bar')).toContain('height: 26px;');
    expect(rule('.judge')).toContain('display: inline-flex;');
    expect(rule('.judge')).toContain('align-items: center;');
    expect(rule('.judge')).toContain('height: 20px;');
    expect(rule('.judge')).toContain('padding: 0 6px;');
    expect(rule('.judge:hover')).toContain('background: var(--bg-hover);');
    expect(css).not.toContain(':global(.arco-btn)');
  });
});
