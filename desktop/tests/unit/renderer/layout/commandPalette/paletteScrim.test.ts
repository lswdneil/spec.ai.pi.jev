/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The veil under the command palette is the page's own scrim token: what lies under the palette recedes, and the
 * page never turns grey.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const renderer = resolve(__dirname, '../../../../../packages/desktop/src/renderer');
const palette = readFileSync(resolve(renderer, 'components/layout/Sider/CommandPalette/index.tsx'), 'utf8');
const tokens = readFileSync(resolve(renderer, 'styles/specjev/tokens.css'), 'utf8');

describe('the command palette’s veil', () => {
  it('is a Radix overlay painted with the scrim token', () => {
    expect(palette).toContain('DialogPrimitive.Overlay');
    expect(palette).toContain('bg-[var(--sv-scrim)]');
    expect(tokens).toMatch(/--sv-scrim: #[0-9a-f]{6}[0-9a-f]{2};/i);
  });
});
