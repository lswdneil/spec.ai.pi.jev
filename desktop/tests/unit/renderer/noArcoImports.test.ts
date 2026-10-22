import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Arco is gone: no renderer source or test may bring it back, and neither package nor lock may
 * carry the dependency. The guard is a file scan, because an import in a lazily loaded page
 * would otherwise only show up when that page is opened.
 */
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const rendererRoot = join(repoRoot, 'packages/desktop/src/renderer');
const testsRoot = join(repoRoot, 'tests/unit');
const SELF = fileURLToPath(import.meta.url);

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

function filesMentioning(dir: string, needle: string): string[] {
  return filesUnder(dir).filter((file) => {
    if (file === SELF) return false;
    return readFileSync(file, 'utf8').includes(needle);
  });
}

describe('the Arco removal', () => {
  it('has no renderer or test reference to the package', () => {
    expect(filesMentioning(rendererRoot, '@arco-design')).toEqual([]);
    expect(filesMentioning(testsRoot, '@arco-design')).toEqual([]);
  });

  it('keeps the package and its lock free of it', () => {
    expect(readFileSync(join(repoRoot, 'package.json'), 'utf8')).not.toContain('@arco-design');
    expect(readFileSync(join(repoRoot, 'bun.lock'), 'utf8')).not.toContain('@arco-design');
  });
});
