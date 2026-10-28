import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RENDERER_ROOT = resolve(process.cwd(), 'packages/desktop/src/renderer');

export function readRendererCss(relativePath: string): string {
  return readFileSync(resolve(RENDERER_ROOT, relativePath), 'utf8');
}

export function cssRules(css: string, selector: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = /(?:^|\n)\s*([^{}]+?)\s*\{([^{}]*)\}/g;
  return [...withoutComments.matchAll(pattern)]
    .filter((match) =>
      match[1]
        .split(',')
        .map((part) => part.trim())
        .includes(selector)
    )
    .map((match) => match[2].trim());
}
