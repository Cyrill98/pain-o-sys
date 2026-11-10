/**
 * Wall recoloring for the photo visualizer. Pure functions over plain pixel buffers, so they
 * run (and are tested) without a canvas.
 *
 * 1. `floodSelect`: from a tapped pixel, grow a region of similar color (the wall).
 * 2. `feather`: soften the mask edge a little so the paint doesn't look cut out.
 * 3. `recolor`: replace the wall's color but keep its light and shadow. Each pixel's brightness
 *    relative to the wall's average brightness is applied to the new color.
 */

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 3×3 box blur of one channel, to ignore single-pixel noise and fine texture. */
function blur3(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, y - 1); j <= Math.min(h - 1, y + 1); j++) {
        for (let i = Math.max(0, x - 1); i <= Math.min(w - 1, x + 1); i++) {
          sum += src[j * w + i]!;
          n++;
        }
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

/** Grow a mask outward by `r` pixels (square window). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(mask.length);
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r) && !v; i++) v = mask[y * w + i]!;
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r) && !v; j++) v = tmp[j * w + x]!;
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Erode then dilate with a square window: removes thin bridges and specks from a mask. */
export function open(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const pass = (src: Uint8Array, grow: boolean) => {
    const tmp = new Uint8Array(src.length);
    const out = new Uint8Array(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = grow ? 0 : 255;
        for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) {
          const m = src[y * w + i]!;
          v = grow ? Math.max(v, m) : Math.min(v, m);
        }
        // Outside the image counts as "not selected" when eroding.
        if (!grow && (x - r < 0 || x + r >= w)) v = 0;
        tmp[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = grow ? 0 : 255;
        for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) {
          const m = tmp[j * w + x]!;
          v = grow ? Math.max(v, m) : Math.min(v, m);
        }
        if (!grow && (y - r < 0 || y + r >= h)) v = 0;
        out[y * w + x] = v;
      }
    }
    return out;
  };
  return pass(pass(mask, false), true);
}

/**
 * Select the wall around (x, y). `tolerance` is 0–100.
 *
 * The region grows pixel by pixel on a slightly blurred copy of the photo. A neighbour joins if
 *  - it is close in colour (hue/saturation) to the tapped wall,
 *  - its brightness is within a generous range of the tapped spot (walls get lighter and darker
 *    with the light), and
 *  - its brightness doesn't jump from the pixel it was reached from (a ceiling line, furniture
 *    edge or window frame is a jump; shading is gradual).
 * Thin leaks into other areas are then cut off by opening the mask. Returns 255 = selected.
 */
export function floodSelect(p: Pixels, x: number, y: number, tolerance: number): Uint8Array {
  const { width: w, height: h, data } = p;
  const mask = new Uint8Array(w * h);
  if (x < 0 || y < 0 || x >= w || y >= h) return mask;

  const n = w * h;
  const L = new Float32Array(n);
  const Cb = new Float32Array(n);
  const Cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const l = luma(r, g, b);
    L[i] = l;
    Cb[i] = b - l;
    Cr[i] = r - l;
  }
  const bL = blur3(L, w, h);
  const bCb = blur3(Cb, w, h);
  const bCr = blur3(Cr, w, h);

  // Reference: average over a small patch around the tap.
  let sL = 0;
  let sCb = 0;
  let sCr = 0;
  let cnt = 0;
  for (let j = Math.max(0, y - 2); j <= Math.min(h - 1, y + 2); j++) {
    for (let i = Math.max(0, x - 2); i <= Math.min(w - 1, x + 2); i++) {
      sL += bL[j * w + i]!;
      sCb += bCb[j * w + i]!;
      sCr += bCr[j * w + i]!;
      cnt++;
    }
  }
  const rL = sL / cnt;
  const rCb = sCb / cnt;
  const rCr = sCr / cnt;

  const capC = 8 + tolerance * 0.6; // colour distance from the tapped wall
  const capL = 40 + tolerance * 1.5; // brightness distance from the tapped spot
  const stepL = 4 + tolerance * 0.12; // brightness change allowed per pixel step
  const stepC = 5 + tolerance * 0.2; // colour change allowed per pixel step

  const grown = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const start = y * w + x;
  grown[start] = 255;
  queue[tail++] = start;
  while (head < tail) {
    const idx = queue[head++]!;
    const cx = idx % w;
    const cy = (idx - cx) / w;
    const around = [
      cx > 0 ? idx - 1 : -1,
      cx < w - 1 ? idx + 1 : -1,
      cy > 0 ? idx - w : -1,
      cy < h - 1 ? idx + w : -1,
    ];
    for (const nb of around) {
      if (nb < 0 || grown[nb]) continue;
      if (Math.abs(bL[nb]! - bL[idx]!) > stepL) continue;
      if (Math.hypot(bCb[nb]! - bCb[idx]!, bCr[nb]! - bCr[idx]!) > stepC) continue;
      if (Math.abs(bL[nb]! - rL) > capL) continue;
      if (Math.hypot(bCb[nb]! - rCb, bCr[nb]! - rCr) > capC) continue;
      grown[nb] = 255;
      queue[tail++] = nb;
    }
  }

  // Cut thin leaks. Keep the result if opening removed the tapped spot (a very small region).
  const cleaned = open(grown, w, h, Math.max(1, Math.round(Math.min(w, h) / 200)));
  return cleaned[start] ? cleaned : grown;
}

/** Paint (value 255) or erase (0) a filled circle on the mask. */
export function brush(
  mask: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  value: 0 | 255,
) {
  const r2 = radius * radius;
  for (
    let y = Math.max(0, Math.floor(cy - radius));
    y <= Math.min(h - 1, Math.ceil(cy + radius));
    y++
  ) {
    for (
      let x = Math.max(0, Math.floor(cx - radius));
      x <= Math.min(w - 1, Math.ceil(cx + radius));
      x++
    ) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) mask[y * w + x] = value;
    }
  }
}

/** Fill small holes (furniture edges, wall sockets) and drop specks, then blur the edge. */
export function feather(mask: Uint8Array, w: number, h: number, radius = 2): Uint8Array {
  // Separable box blur: two passes over rows then columns, using running sums.
  const tmp = new Float32Array(w * h);
  const out = new Uint8Array(w * h);
  const size = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += mask[y * w + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / size;
      sum +=
        mask[y * w + Math.min(w - 1, x + radius + 1)]! - mask[y * w + Math.max(0, x - radius)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = Math.round(sum / size);
      sum += tmp[Math.min(h - 1, y + radius + 1) * w + x]! - tmp[Math.max(0, y - radius) * w + x]!;
    }
  }
  return out;
}

/** Average brightness of the selected pixels (the reference for "how lit is this part of the wall"). */
export function meanLuma(p: Pixels, mask: Uint8Array): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]! < 128) continue;
    const k = i * 4;
    sum += luma(p.data[k]!, p.data[k + 1]!, p.data[k + 2]!);
    n++;
  }
  return n > 0 ? sum / n : 128;
}

/**
 * Returns a new pixel buffer with the masked area painted `hex`. Light and shadow from the
 * photo are kept, within limits so very dark or blown-out spots don't look odd.
 */
export function recolor(src: Pixels, mask: Uint8Array, hex: string): Pixels {
  const out = new Uint8ClampedArray(src.data);
  const [tr, tg, tb] = hexToRgb(hex);
  const ref = Math.max(meanLuma(src, mask), 1);
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i]! / 255;
    if (a === 0) continue;
    const k = i * 4;
    const r = src.data[k]!;
    const g = src.data[k + 1]!;
    const b = src.data[k + 2]!;
    const ratio = Math.min(1.6, Math.max(0.35, luma(r, g, b) / ref));
    out[k] = r + (Math.min(255, tr * ratio) - r) * a;
    out[k + 1] = g + (Math.min(255, tg * ratio) - g) * a;
    out[k + 2] = b + (Math.min(255, tb * ratio) - b) * a;
  }
  return { data: out, width: src.width, height: src.height };
}
