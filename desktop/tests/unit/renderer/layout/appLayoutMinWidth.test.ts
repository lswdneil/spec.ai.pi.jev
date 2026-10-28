/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  resolve(__dirname, '../../../../packages/desktop/src/renderer/styles/themes/base.css'),
  'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the rule whose selector list names `selector`. */
function body(selector: string): string {
  const rule = (css.match(/[^{}]+\{[^}]+\}/g) ?? []).find((candidate) =>
    candidate
      .slice(0, candidate.indexOf('{'))
      .split(',')
      .some((part) => part.trim() === selector)
  );
  return rule?.slice(rule.indexOf('{') + 1, -1) ?? '';
}

describe('app layout minimum width', () => {
  // jsdom does not resolve flex layout or viewport geometry, so the 360px
  // composer bounds are checked in the real app. This locks the cascade split
  // that lets the route column use only the width left beside the sidebar.
  it('keeps the outer shell at 360px while letting the route column shrink', () => {
    expect(body(':root')).toContain('--app-min-width: 360px');
    for (const selector of ['html', 'body', '#root', '.layout']) {
      expect(body(selector)).toContain('min-width: var(--app-min-width)');
    }

    expect(body('.layout-content')).toContain('min-width: 0');
    expect(body('.layout-content')).not.toContain('var(--app-min-width)');
  });
});
