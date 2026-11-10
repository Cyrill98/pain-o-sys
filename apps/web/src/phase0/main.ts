/**
 * Dev-only page for the Phase 0 check: runs the visualizer's recolor code on a folder of photos
 * and shows original | light color | dark color side by side. Open /phase0.html in `npm run dev`.
 * Optional query: ?only=5,6 (photo numbers) and ?tol=35 (default tolerance).
 */
import { feather, floodSelect, recolor } from '../lib/recolor';

const urls = import.meta.glob('../../phase0-photos/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Seeds are taps in fractions of the image (x, y). Chosen by eye per photo. */
const SEEDS: Record<number, { taps: [number, number][]; tol?: number; note?: string }> = {
  1: {
    taps: [
      [0.25, 0.3],
      [0.96, 0.35],
    ],
    note: 'beige wall, sofa, art, door',
  },
  2: {
    taps: [
      [0.5, 0.05],
      [0.9, 0.25],
    ],
    note: 'grey wall, framed prints',
  },
  3: { taps: [[0.6, 0.2]], note: 'white wall, many frames, bright window' },
  4: {
    taps: [
      [0.1, 0.3],
      [0.7, 0.3],
    ],
    note: 'pink walls, two colored sofas',
  },
  5: { taps: [[0.93, 0.3]], note: 'wood panel wall (hard), white side wall' },
  6: {
    taps: [
      [0.1, 0.25],
      [0.6, 0.1],
    ],
    note: 'green panelled walls + fireplace',
  },
  7: { taps: [[0.3, 0.2]], note: 'dark grey wall, bright floor' },
  8: { taps: [[0.2, 0.3]], note: 'wood plank wall (hard)' },
  9: { taps: [[0.5, 0.3]], note: 'plain beige wall, soft light' },
  10: { taps: [[0.2, 0.2]], note: 'plain wall with watermark' },
  11: { taps: [[0.7, 0.2]], note: 'stone chimney (hard)' },
  12: { taps: [[0.1, 0.3]], note: 'dark wood 3D panels (hard)' },
  13: {
    taps: [
      [0.55, 0.07],
      [0.62, 0.45],
    ],
    note: 'white wall, frames, TV, hanging bulbs',
  },
  14: {
    taps: [
      [0.1, 0.5],
      [0.6, 0.3],
    ],
    note: 'green wall, corner, shelves',
  },
  15: { taps: [[0.3, 0.3]], note: 'wallpaper pattern (hard)' },
  16: { taps: [[0.2, 0.2]], note: 'yellow wall, frame, cabinet, sofa' },
  17: { taps: [[0.5, 0.12]], note: 'beige wall with 3D relief (hard)' },
  18: { taps: [[0.5, 0.2]], note: 'concrete-look texture (hard)' },
  19: { taps: [[0.4, 0.2]], note: 'cream wall, arch, dark wood trim' },
  20: { taps: [[0.2, 0.15]], note: 'dark red wall, frames' },
};

const COLORS = { light: '#8FB8A6', dark: '#1F2A55' };
const MAX_SIDE = 1024;
const q = new URLSearchParams(location.search);
const only = q.get('only')?.split(',').map(Number);
const defaultTol = Number(q.get('tol') ?? 35);

function sized(w: number, h: number) {
  const s = Math.min(1, MAX_SIDE / Math.max(w, h));
  return [Math.round(w * s), Math.round(h * s)] as const;
}

async function run() {
  const out = document.getElementById('out')!;
  const entries = Object.entries(urls).sort(([a], [b]) => a.localeCompare(b));
  const stats: Record<string, unknown>[] = [];
  for (const [path, url] of entries) {
    const n = Number(/p(\d+)\./.exec(path)![1]);
    if (only && !only.includes(n)) continue;
    const cfg = SEEDS[n]!;
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const [w, h] = sized(bmp.width, bmp.height);
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const ctx = base.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const pixels = { data: img.data, width: w, height: h };

    const t0 = performance.now();
    const mask = new Uint8Array(w * h);
    for (const [fx, fy] of cfg.taps) {
      const region = floodSelect(
        pixels,
        Math.floor(fx * w),
        Math.floor(fy * h),
        cfg.tol ?? defaultTol,
      );
      for (let i = 0; i < region.length; i++) if (region[i]) mask[i] = 255;
    }
    const soft = feather(mask, w, h, Math.max(1, Math.round(w / 500)));
    const tSelect = performance.now() - t0;
    let selected = 0;
    for (const v of mask) if (v) selected++;

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="n">${n}</div>`;
    const panels: HTMLCanvasElement[] = [base];
    for (const hex of Object.values(COLORS)) {
      const t1 = performance.now();
      const r = recolor(pixels, soft, hex);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.putImageData(
        new ImageData(r.data as Uint8ClampedArray<ArrayBuffer>, w, h),
        0,
        0,
      );
      panels.push(c);
      stats.push({ n, recolorMs: Math.round(performance.now() - t1) });
    }
    // Original is drawn onto a copy so it keeps its own canvas.
    const orig = document.createElement('canvas');
    orig.width = w;
    orig.height = h;
    orig.getContext('2d')!.drawImage(base, 0, 0);
    panels[0] = orig;
    panels.forEach((c) => row.appendChild(c));
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${cfg.note} · ${w}×${h} · wall ${((100 * selected) / (w * h)).toFixed(0)}% selected · select ${tSelect.toFixed(0)} ms`;
    row.appendChild(meta);
    out.appendChild(row);
  }
  document.title = 'phase0 done';
  (window as unknown as { __phase0: unknown }).__phase0 = stats;
}

void run();
