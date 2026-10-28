import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const rendererRoot = join(repoRoot, 'packages/desktop/src/renderer');

// Exact whole-token matches: `arco-input` must not reject `arco-input-error`,
// and `arco-btn` must not reject `arco-btn-primary`.
const deadArcoInternals = [
  'arco-alert-content',
  'arco-alert-content-wrapper',
  'arco-alert-icon',
  'arco-btn',
  'arco-btn-content',
  'arco-btn-disabled',
  'arco-btn-outline',
  'arco-btn-text',
  'arco-card',
  'arco-card-header',
  'arco-checkbox-checked',
  'arco-checkbox-disabled',
  'arco-checkbox-indeterminate',
  'arco-checkbox-mask',
  'arco-checkbox-mask-icon',
  'arco-collapse-item',
  'arco-collapse-item-content',
  'arco-collapse-item-content-box',
  'arco-collapse-item-header',
  'arco-collapse-item-header-title',
  'arco-dropdown',
  'arco-form-item-label-col',
  'arco-input',
  'arco-input-focus',
  'arco-input-group-addafter',
  'arco-input-group-addbefore',
  'arco-input-group-prefix',
  'arco-input-group-suffix',
  'arco-input-inner-wrapper',
  'arco-input-inner-wrapper-focus',
  'arco-input-tag-focus',
  'arco-layout',
  'arco-layout-content',
  'arco-layout-sider-children',
  'arco-layout-sider-collapsed',
  'arco-link',
  'arco-link-disabled',
  'arco-menu-selected',
  'arco-message-wrapper',
  'arco-modal',
  'arco-picker-focused',
  'arco-popover-content',
  'arco-radio-button',
  'arco-radio-checked',
  'arco-radio-disabled',
  'arco-radio-group',
  'arco-select-addbefore',
  'arco-select-focused',
  'arco-select-suffix',
  'arco-select-view',
  'arco-tabs-tab-active',
  'arco-textarea',
  'arco-textarea-focus',
  'arco-tooltip-popup',
];

const liveCompatibilityClasses = [
  'arco-tag',
  'arco-select',
  'arco-select-view-value',
  'arco-btn-primary',
  'arco-badge-status-success',
  'arco-input-error',
  'arco-input-warning',
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const classPattern = (className: string) => new RegExp(`(?<![\\w-])${escapeRegExp(className)}(?![\\w-])`);

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

describe('Arco CSS compatibility cleanup', () => {
  it('does not leave dead Arco internals in renderer sources or styles', () => {
    const findings = filesUnder(rendererRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return deadArcoInternals
        .filter((className) => classPattern(className).test(source))
        .map((className) => `${file}: ${className}`);
    });

    expect(findings).toEqual([]);
  });

  it('does not reject the live compatibility classes', () => {
    for (const className of liveCompatibilityClasses) {
      expect(deadArcoInternals.some((dead) => classPattern(dead).test(className))).toBe(false);
    }
  });
});
