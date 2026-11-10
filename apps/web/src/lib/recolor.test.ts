import { describe, expect, it } from 'vitest';
import { brush, dilate, feather, floodSelect, hexToRgb, recolor, type Pixels } from './recolor';

/** A w×h image: left half `a`, right half `b` (RGB triples). */
function twoTone(w: number, h: number, a: number[], b: number[]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = x < w / 2 ? a : b;
      const k = (y * w + x) * 4;
      data[k] = c[0]!;
      data[k + 1] = c[1]!;
      data[k + 2] = c[2]!;
      data[k + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe('hexToRgb', () => {
  it('parses #RRGGBB', () => {
    expect(hexToRgb('#FF8000')).toEqual([255, 128, 0]);
  });
});

describe('floodSelect', () => {
  it('selects the tapped region and stops at a different color', () => {
    const p = twoTone(20, 10, [230, 225, 215], [40, 90, 160]);
    const mask = floodSelect(p, 3, 5, 30);
    expect(mask[5 * 20 + 3]).toBe(255);
    expect(mask[5 * 20 + 7]).toBe(255);
    expect(mask[5 * 20 + 12]).toBe(0);
  });

  it('follows gentle shading across a wall', () => {
    const w = 30;
    const h = 4;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      const shade = 235 - (i % w) * 2; // slow gradient: 235 → 177
      data.set([shade, shade - 5, shade - 12, 255], i * 4);
    }
    const mask = floodSelect({ data, width: w, height: h }, 0, 1, 40);
    expect(mask[1 * w + w - 1]).toBe(255);
  });

  it('ignores taps outside the image', () => {
    const p = twoTone(4, 4, [200, 200, 200], [200, 200, 200]);
    expect(floodSelect(p, -1, 0, 50).every((v) => v === 0)).toBe(true);
  });
});

describe('brush', () => {
  it('paints and erases a circle', () => {
    const mask = new Uint8Array(10 * 10);
    brush(mask, 10, 10, 5, 5, 2, 255);
    expect(mask[5 * 10 + 5]).toBe(255);
    expect(mask[0]).toBe(0);
    brush(mask, 10, 10, 5, 5, 1, 0);
    expect(mask[5 * 10 + 5]).toBe(0);
  });
});

describe('dilate', () => {
  it('grows the selection by the given radius and nothing more', () => {
    const w = 11;
    const mask = new Uint8Array(w * w);
    mask[5 * w + 5] = 255;
    const out = dilate(mask, w, w, 2);
    expect(out[5 * w + 7]).toBe(255);
    expect(out[3 * w + 3]).toBe(255);
    expect(out[5 * w + 8]).toBe(0);
    expect(out[0]).toBe(0);
  });
});

describe('feather', () => {
  it('softens the edge but keeps the interior solid', () => {
    const w = 20;
    const mask = new Uint8Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < 10; x++) mask[y * w + x] = 255;
    const soft = feather(mask, w, w, 2);
    expect(soft[10 * w + 2]).toBe(255);
    expect(soft[10 * w + 10]).toBeGreaterThan(0);
    expect(soft[10 * w + 10]).toBeLessThan(255);
    expect(soft[10 * w + 18]).toBe(0);
  });
});

describe('recolor', () => {
  it('paints the masked pixels, leaves the rest, and keeps relative shading', () => {
    const w = 4;
    const data = new Uint8ClampedArray(w * 1 * 4);
    // Three wall pixels (bright, mid, dark) and one non-wall pixel.
    data.set([240, 240, 240, 255, 200, 200, 200, 255, 120, 120, 120, 255, 10, 80, 10, 255]);
    const src: Pixels = { data, width: w, height: 1 };
    const mask = new Uint8Array([255, 255, 255, 0]);
    const out = recolor(src, mask, '#3366CC');
    const lum = (k: number) => out.data[k]! + out.data[k + 1]! + out.data[k + 2]!;
    expect(lum(0)).toBeGreaterThan(lum(4));
    expect(lum(4)).toBeGreaterThan(lum(8));
    expect(Array.from(out.data.slice(12, 16))).toEqual([10, 80, 10, 255]);
    // Hue moved toward blue on a painted pixel.
    expect(out.data[6]!).toBeGreaterThan(out.data[4]!);
  });
});
