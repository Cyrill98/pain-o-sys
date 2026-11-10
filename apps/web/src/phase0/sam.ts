/**
 * Dev-only: tests SlimSAM (Apache-2.0, tap-prompted segmentation) on the Phase 0 photos.
 * Open /phase0-sam.html in `npm run dev -w @app/web`. Query: ?only=1,2
 */
import { AutoProcessor, RawImage, SamModel, Tensor } from '@huggingface/transformers';
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

/** The parts of the SAM API this page uses (transformers.js doesn't type them). */
interface SamApi {
  get_image_embeddings(inputs: unknown): Promise<Record<string, unknown>>;
}
interface SamProcessorApi {
  post_process_masks(masks: unknown, original: unknown, reshaped: unknown): Promise<unknown[]>;
}

const HEX = '#1F2A55';
const MAX_SIDE = 1024;
const params = new URLSearchParams(location.search);
const only = params.get('only')?.split(',').map(Number);
const gpu = params.get('gpu') === '1';
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
  const id = 'Xenova/slimsam-77-uniform';
  const model = await SamModel.from_pretrained(
    id,
    gpu ? { device: 'webgpu', dtype: 'fp32' } : { dtype: 'q8' },
  );
  const processor = await AutoProcessor.from_pretrained(id);
  status.textContent = `${gpu ? 'WebGPU' : 'WASM'}: model ready in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
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

    const tap = new Uint8Array(w * h);
    for (const [fx, fy] of taps) {
      const r = floodSelect(px, Math.floor(fx * w), Math.floor(fy * h), 35);
      for (let i = 0; i < r.length; i++) if (r[i]) tap[i] = 255;
    }

    // SlimSAM: embed the image once, then decode one mask set per tap.
    const t1 = performance.now();
    const image = await RawImage.fromURL(base.toDataURL('image/jpeg', 0.92));
    const inputs = await processor(image);
    const embeddings = await (model as unknown as SamApi).get_image_embeddings(inputs);
    const tEmbed = Math.round(performance.now() - t1);

    const best = new Uint8Array(w * h);
    const largest = new Uint8Array(w * h);
    const t2 = performance.now();
    for (const [fx, fy] of taps) {
      const pts = await processor(image, {
        input_points: [[[fx * image.width, fy * image.height]]],
      });
      const o = await model({
        ...embeddings,
        input_points: pts.input_points,
        input_labels: new Tensor('int64', new BigInt64Array([1n]), [1, 1, 1]),
      });
      const masks = (
        await (processor as unknown as SamProcessorApi).post_process_masks(
          o.pred_masks,
          pts.original_sizes,
          pts.reshaped_input_sizes,
        )
      )[0] as Tensor;
      const scores = Array.from(o.iou_scores.data as Float32Array);
      const [, k, mh, mw] = masks.dims as number[];
      const data = masks.data as Uint8Array;
      let bi = 0;
      let li = 0;
      let lArea = -1;
      for (let m = 0; m < k!; m++) {
        if (scores[m]! > scores[bi]!) bi = m;
        let area = 0;
        for (let i = 0; i < mh! * mw!; i++) if (data[m * mh! * mw! + i]) area++;
        if (area > lArea) {
          lArea = area;
          li = m;
        }
      }
      const put = (target: Uint8Array, m: number) => {
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            if (data[m * mh! * mw! + Math.floor((j / h) * mh!) * mw! + Math.floor((i / w) * mw!)])
              target[j * w + i] = 255;
          }
        }
      };
      put(best, bi);
      put(largest, li);
    }
    const tDecode = Math.round(performance.now() - t2);

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="n">${n}</div>`;
    const orig = document.createElement('canvas');
    orig.width = w;
    orig.height = h;
    orig.getContext('2d')!.drawImage(base, 0, 0);
    [orig, paint(base, tap), paint(base, best), paint(base, largest)].forEach((c) =>
      row.appendChild(c),
    );
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `image encode ${tEmbed} ms · decode ${tDecode} ms for ${taps.length} tap(s)`;
    row.appendChild(meta);
    out.appendChild(row);
    summary.push({ n, tEmbed, tDecode });
  }
  document.title = 'phase0-sam done';
  (window as unknown as { __sam: unknown }).__sam = summary;
}

run().catch((e) => {
  status.textContent = `Failed: ${String(e)}`;
  document.title = 'phase0-sam failed';
});
