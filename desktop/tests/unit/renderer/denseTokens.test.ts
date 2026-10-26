import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const rendererTokens = readFileSync(join(root, 'packages/desktop/src/renderer/styles/specjev/tokens.css'), 'utf8');
const designTokens = JSON.parse(readFileSync(join(root, '../design/tokens.json'), 'utf8')) as {
  typography: { sizes: Record<string, string> };
  radius: Record<string, string>;
  layout: Record<string, string>;
};

describe('the Dense token contract', () => {
  it('keeps the type scale in both the app and the design source', () => {
    const sizes = {
      '--sv-fs-caption': '11.5px',
      '--sv-fs-small': '11.5px',
      '--sv-fs-meta': '12px',
      '--sv-fs-body': '13px',
      '--sv-fs-body-lg': '15px',
      '--sv-fs-title': '18px',
      '--sv-fs-h1': '20px',
      '--sv-fs-display': 'clamp(26px, 3.4vw, 34px)',
    };
    for (const [name, value] of Object.entries(sizes)) expect(rendererTokens).toContain(`${name}: ${value};`);
    expect(designTokens.typography.sizes).toMatchObject({
      caption: '11.5px',
      small: '11.5px',
      meta: '12px',
      body: '13px',
      bodyLarge: '15px',
      title: '18px',
      h1: '20px',
    });
  });

  it('keeps the Dense radii and layout', () => {
    for (const [name, value] of Object.entries({
      '--sv-r-small': '8px',
      '--sv-r-control': '8px',
      '--sv-r-chrome': '10px',
      '--sv-r-popup': '10px',
      '--sv-r-composer': '12px',
      '--sv-r-dialog': '12px',
      '--sv-sidebar': '208px',
      '--sv-rail': '300px',
      '--sv-topbar': '40px',
    })) {
      expect(rendererTokens).toContain(`${name}: ${value};`);
    }
    expect(designTokens.radius).toMatchObject({
      control: '8px',
      chrome: '10px',
      popup: '10px',
      composer: '12px',
      dialog: '12px',
      small: '8px',
    });
    expect(designTokens.layout).toMatchObject({ sidebar: '208px', rail: '300px', topbar: '40px' });
  });
});
