import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
const renderer = resolve(ROOT, 'packages/desktop/src/renderer/assets');
const logo = readFileSync(resolve(renderer, 'logo.svg'), 'utf8');
const rendererMark = readFileSync(resolve(renderer, 'logos/brand/app.png'));

/** Width and height from a PNG's IHDR chunk. */
function pngSize(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe('spec.jev brand mark', () => {
  it('draws the in-app mark and logo.svg from the same 512 px artwork', () => {
    const embedded = /href="data:image\/png;base64,([^"]+)"/.exec(logo)?.[1];
    expect(embedded).toBeDefined();
    expect(Buffer.from(embedded as string, 'base64')).toEqual(rendererMark);
  });

  it('keeps every icon square, including the Windows and macOS bundles', () => {
    const png = readFileSync(resolve(ROOT, 'resources/app.png'));
    expect(pngSize(png)).toEqual({ width: 1024, height: 1024 });
    expect(pngSize(readFileSync(resolve(ROOT, 'resources/icon.png')))).toEqual({ width: 800, height: 800 });

    const icns = readFileSync(resolve(ROOT, 'resources/app.icns'));
    expect(icns.subarray(0, 4).toString('ascii')).toBe('icns');
    expect(icns.includes(Buffer.from('ic10'))).toBe(true);

    const ico = readFileSync(resolve(ROOT, 'resources/app.ico'));
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(7);
  });

  it('keeps the brand source at the size the icon build expects', () => {
    const source = readFileSync(resolve(ROOT, 'resources/brand/mu-icon-source.png'));
    const { width, height } = pngSize(source);
    expect(width).toBeGreaterThanOrEqual(256);
    expect(height).toBeGreaterThanOrEqual(128);
    expect(width / height).toBeGreaterThan(1);
  });
});
