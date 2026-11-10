/**
 * Dev-only: compares the color-based tap-select with a pretrained SegFormer (ADE20K) model on the
 * Phase 0 photos. Open /phase0-seg.html in `npm run dev -w @app/web`. Query: ?only=1,2
 */
import { pipeline } from '@huggingface/transformers';
import { feather, floodSelect, recolor } from '../lib/recolor';

const urls = import.meta.glob('../../phase0-photos/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const TAPS: Record<number, [number, number][]> = {
  1: [
    [0.25, 0.3],
    [0.96, 0.35],
  ],
  2: [
    [0.5, 0.05],
    [0.9, 0.25],
  ],
  3: [[0.6, 0.2]],
  4: [
    [0.1, 0.3],
    [0.7, 0.3],
  ],
  5: [[0.93, 0.3]],
  6: [
    [0.1, 0.25],
    [0.6, 0.1],
  ],
  7: [[0.3, 0.2]],
  8: [[0.2, 0.3]],
  9: [[0.5, 0.3]],
  10: [[0.2, 0.2]],
  11: [[0.7, 0.2]],
  12: [[0.1, 0.3]],
  13: [
    [0.55, 0.07],
    [0.62, 0.45],
  ],
  14: [
    [0.1, 0.5],
    [0.6, 0.3],
  ],
  15: [[0.3, 0.3]],
  16: [[0.2, 0.2]],
  17: [[0.5, 0.12]],
  18: [[0.5, 0.2]],
  19: [[0.4, 0.2]],
  20: [[0.2, 0.15]],
};

const HEX = '#1F2A55';
const MAX_SIDE = 1024;
const only = new URLSearchParams(location.search).get('only')?.split(',').map(Number);
const status = document.getElementById('status')!;

function paint(base: HTMLCanvasElement, mask: Uint8Array) {
  const { width: w, height: h } = base;
  const img = base.getContext('2d')!.getImageData(0, 0, w, h);
  const px = { data: img.data, width: w, height: h };
  const out = recolor(px, feather(mask, w, h, Math.max(1, Math.round(w / 500))), HEX);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(
    new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, w, h),
    0,
    0,
  );
  return c;
}

async function run() {
  const t0 = performance.now();
  const segmenter = await pipeline(
    'image-segmentation',
    'Xenova/segformer-b0-finetuned-ade-512-512',
    { dtype: 'q8' },
  );
  status.textContent = `Model ready in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
  const out = document.getElementById('out')!;
  const summary: Record<string, unknown>[] = [];

  for (const [path, url] of Object.entries(urls).sort(([a], [b]) => a.localeCompare(b))) {
    const n = Number(/p(\d+)\./.exec(path)![1]);
    if (only && !only.includes(n)) continue;
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * s);
    const h = Math.round(bmp.height * s);
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const ctx = base.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const px = { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
    const taps = TAPS[n]!;

    // 1. color-based tap-select (current app behaviour)
    const tap = new Uint8Array(w * h);
    for (const [fx, fy] of taps) {
      const r = floodSelect(px, Math.floor(fx * w), Math.floor(fy * h), 35);
      for (let i = 0; i < r.length; i++) if (r[i]) tap[i] = 255;
    }

    // 2. SegFormer: all pixels with the same label as the tapped pixel
    const t1 = performance.now();
    const segments = (await segmenter(base.toDataURL('image/jpeg', 0.9))) as {
      label: string;
      mask: { data: Uint8Array | Uint8ClampedArray; width: number; height: number };
    }[];
    const ms = Math.round(performance.now() - t1);
    const seg = new Uint8Array(w * h);
    const labels: string[] = [];
    for (const [fx, fy] of taps) {
      const x = Math.floor(fx * w);
      const y = Math.floor(fy * h);
      const hit = segments.find(
        (sg) =>
          sg.mask.data[
            Math.floor((y / h) * sg.mask.height) * sg.mask.width +
              Math.floor((x / w) * sg.mask.width)
          ]! > 0,
      );
      if (!hit) continue;
      labels.push(hit.label);
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const mi =
            Math.floor((j / h) * hit.mask.height) * hit.mask.width +
            Math.floor((i / w) * hit.mask.width);
          if (hit.mask.data[mi]! > 0) seg[j * w + i] = 255;
        }
      }
    }

    // 3. SegFormer limited to what is also color-reachable from the tap (loose color growth)
    const loose = new Uint8Array(w * h);
    for (const [fx, fy] of taps) {
      const r = floodSelect(px, Math.floor(fx * w), Math.floor(fy * h), 70);
      for (let i = 0; i < r.length; i++) if (r[i]) loose[i] = 255;
    }
    const both = new Uint8Array(w * h);
    for (let i = 0; i < both.length; i++) both[i] = seg[i] && loose[i] ? 255 : 0;

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="n">${n}</div>`;
    const orig = document.createElement('canvas');
    orig.width = w;
    orig.height = h;
    orig.getContext('2d')!.drawImage(base, 0, 0);
    [orig, paint(base, tap), paint(base, seg), paint(base, both)].forEach((c) =>
      row.appendChild(c),
    );
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `tapped labels: ${labels.join(', ') || 'none'} · model ${ms} ms`;
    row.appendChild(meta);
    out.appendChild(row);
    summary.push({ n, labels, ms });
  }
  document.title = 'phase0-seg done';
  (window as unknown as { __seg: unknown }).__seg = summary;
}

run().catch((e) => {
  status.textContent = `Failed: ${String(e)}`;
  document.title = 'phase0-seg failed';
});
