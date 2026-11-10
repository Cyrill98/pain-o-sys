/**
 * Downloads the wall-selection model (SlimSAM, Apache-2.0) and copies the ONNX Runtime
 * WebAssembly files into public/, so the app serves them itself (no third-party requests at
 * run time). Safe to run repeatedly: files that are already present with the right size are
 * skipped. Runs automatically before `npm run dev` and `npm run build`.
 */
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'Xenova/slimsam-77-uniform';
// Pinned revision, so the files never change underneath us.
const REVISION = '5850ab45f587c112167512ffef949107115e26a0';
const MODEL_DIR = path.join(root, 'public/models/slimsam-77-uniform');

const FILES = [
  ['config.json', 379],
  ['preprocessor_config.json', 466],
  ['onnx/vision_encoder_quantized.onnx', 8882165],
  ['onnx/prompt_encoder_mask_decoder_quantized.onnx', 4903810],
  ['onnx/vision_encoder_fp16.onnx', 12170657],
  ['onnx/prompt_encoder_mask_decoder_fp16.onnx', 8550118],
];

async function size(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return -1;
  }
}

for (const [name, expected] of FILES) {
  const dest = path.join(MODEL_DIR, name);
  if ((await size(dest)) === expected) continue;
  await mkdir(path.dirname(dest), { recursive: true });
  const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${name}`;
  console.log(`Downloading ${name} …`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length !== expected)
    throw new Error(`${name}: got ${buf.length} bytes, expected ${expected}`);
  await writeFile(dest, buf);
}

await writeFile(
  path.join(MODEL_DIR, 'LICENSE.txt'),
  `SlimSAM-77 (uniform), ONNX build by Xenova, revision ${REVISION}.\n` +
    `Source: https://huggingface.co/${REPO} (derived from nielsr/slimsam-77-uniform, SlimSAM by Chen et al.,\n` +
    `which compresses Meta's Segment Anything Model).\n` +
    `License as listed on the model card: Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0).\n`,
);

// ONNX Runtime WebAssembly files (CPU build and the WebGPU build).
const require = createRequire(import.meta.url);
const ortDist = path.dirname(require.resolve('onnxruntime-web'));
const ORT_DIR = path.join(root, 'public/ort');
await mkdir(ORT_DIR, { recursive: true });
for (const f of [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
]) {
  const src = path.join(ortDist, f);
  const dest = path.join(ORT_DIR, f);
  if ((await size(dest)) !== (await size(src))) await copyFile(src, dest);
}
console.log('Model and runtime files are ready.');
