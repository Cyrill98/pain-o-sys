/**
 * Smart wall selection with SlimSAM (Apache-2.0), a small "segment anything" model that runs in
 * the browser. The photo is analyzed once (`embed`); after that, each tap outlines the tapped
 * object quickly (`select`). Everything is lazy: nothing here loads until the visualizer asks,
 * and the model files are served from our own site (see scripts/fetch-models.mjs).
 *
 * The caller falls back to the color-based selection in `recolor.ts` when this fails or isn't
 * supported.
 */
import type { Tensor } from '@huggingface/transformers';
import { dilate } from './recolor';

export type SegmenterDevice = 'webgpu' | 'wasm';

export interface Embedding {
  readonly width: number;
  readonly height: number;
  dispose(): void;
}

export interface Segmenter {
  readonly device: SegmenterDevice;
  /** Analyze a photo (once). Takes about 1 s with WebGPU, about 4 s or more without. */
  embed(canvas: HTMLCanvasElement): Promise<Embedding>;
  /** Mask (255 = selected) for the object at pixel (x, y) of the analyzed photo. */
  select(embedding: Embedding, x: number, y: number): Promise<Uint8Array>;
}

/** The parts of the SAM API we use (transformers.js doesn't type them). */
interface SamModelApi {
  (inputs: Record<string, unknown>): Promise<{ pred_masks: unknown; iou_scores: Tensor }>;
  get_image_embeddings(inputs: unknown): Promise<Record<string, unknown>>;
}
interface SamProcessorApi {
  (image: unknown, options?: unknown): Promise<Record<string, unknown>>;
  post_process_masks(masks: unknown, original: unknown, reshaped: unknown): Promise<Tensor[]>;
}

const MODEL = 'slimsam-77-uniform';

/** WebGPU is used when the browser offers it with 16-bit float support; otherwise WebAssembly. */
async function pickDevice(): Promise<SegmenterDevice> {
  try {
    const gpu = (
      navigator as Navigator & {
        gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> };
      }
    ).gpu;
    const adapter = await gpu?.requestAdapter();
    if (adapter?.features.has('shader-f16')) return 'webgpu';
  } catch {
    // fall through
  }
  return 'wasm';
}

export function segmenterSupported() {
  return typeof WebAssembly !== 'undefined' && typeof createImageBitmap === 'function';
}

let loading: Promise<Segmenter> | null = null;

/** Start (or reuse) loading the model. Rejects if it can't be loaded; call `resetSegmenter` to retry. */
export function loadSegmenter(onProgress?: (percent: number) => void): Promise<Segmenter> {
  loading ??= create(onProgress).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

async function create(onProgress?: (percent: number) => void): Promise<Segmenter> {
  const tf = await import('@huggingface/transformers');
  const { env, SamModel, AutoProcessor, RawImage, Tensor: TensorClass } = tf;
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = '/models/';
  // Production serves the WebAssembly runtime from our own site (the security policy blocks
  // third-party scripts). Vite's dev server refuses to load scripts from public/ as modules, so
  // development uses the library's default CDN. (Detected from the module URL rather than
  // import.meta.env, so a stray NODE_ENV in .env can't silently switch this off.)
  const viteDevServer = import.meta.url.includes('/src/');
  const wasm = env.backends.onnx.wasm;
  if (wasm && !viteDevServer) {
    env.useWasmCache = false; // load the files directly instead of re-wrapping them in blob: URLs
    // Same choice the library makes: the plain build only for Safari without WebGPU.
    const ua = navigator.userAgent;
    const oldSafari =
      /^((?!chrome|android|crios|fxios).)*safari/i.test(ua) && !('gpu' in navigator);
    const name = `/ort/ort-wasm-simd-threaded${oldSafari ? '' : '.asyncify'}`;
    wasm.wasmPaths = { mjs: `${name}.mjs`, wasm: `${name}.wasm` };
  }

  const files = new Map<string, number>();
  const progress_callback = (p: { status: string; file?: string; progress?: number }) => {
    if (p.status === 'progress' && p.file && typeof p.progress === 'number') {
      files.set(p.file, p.progress);
      const values = [...files.values()];
      onProgress?.(Math.round(values.reduce((a, b) => a + b, 0) / values.length));
    }
  };

  const load = async (device: SegmenterDevice) =>
    (await SamModel.from_pretrained(MODEL, {
      device,
      dtype: device === 'webgpu' ? 'fp16' : 'q8',
      progress_callback,
    })) as unknown as SamModelApi;

  let device = await pickDevice();
  let model: SamModelApi;
  try {
    model = await load(device);
  } catch (err) {
    if (device === 'wasm') throw err;
    device = 'wasm'; // WebGPU failed to start: try the WebAssembly build
    model = await load('wasm');
  }
  const processor = (await AutoProcessor.from_pretrained(MODEL)) as unknown as SamProcessorApi;

  interface Internal extends Embedding {
    image: unknown;
    embeddings: Record<string, unknown>;
  }

  return {
    device,

    async embed(canvas) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/jpeg',
          0.92,
        ),
      );
      const image = await RawImage.fromBlob(blob);
      const inputs = await processor(image);
      const embeddings = await model.get_image_embeddings(inputs);
      const result: Internal = {
        width: canvas.width,
        height: canvas.height,
        image,
        embeddings,
        dispose() {
          for (const v of Object.values(embeddings)) (v as { dispose?: () => void })?.dispose?.();
        },
      };
      return result;
    },

    async select(embedding, x, y) {
      const { image, embeddings, width, height } = embedding as Internal;
      const pts = await processor(image, { input_points: [[[x, y]]] });
      const out = await model({
        ...embeddings,
        input_points: pts.input_points,
        input_labels: new TensorClass('int64', new BigInt64Array([1n]), [1, 1, 1]),
      });
      const masks = (
        await processor.post_process_masks(
          out.pred_masks,
          pts.original_sizes,
          pts.reshaped_input_sizes,
        )
      )[0]!;
      const [, count, mh, mw] = masks.dims as number[];
      const data = masks.data as Uint8Array;
      const scores = out.iou_scores.data as Float32Array;
      let best = 0;
      for (let m = 1; m < count!; m++) if (scores[m]! > scores[best]!) best = m;

      const mask = new Uint8Array(width * height);
      const offset = best * mh! * mw!;
      for (let j = 0; j < height; j++) {
        const row = Math.min(mh! - 1, Math.floor((j / height) * mh!)) * mw!;
        for (let i = 0; i < width; i++) {
          if (data[offset + row + Math.min(mw! - 1, Math.floor((i / width) * mw!))])
            mask[j * width + i] = 255;
        }
      }
      // The model's outline is a touch tight, which leaves a pale halo around furniture and
      // frames. Grow it slightly; the soft edge in the preview hides the overlap.
      return dilate(mask, width, height, Math.max(1, Math.round(Math.max(width, height) / 500)));
    },
  };
}
