import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Generates favicon, PWA icons (64/192/512), a maskable icon and the Apple touch icon from
// public/icon.svg at build time. Padded icons get the Tenang sand background.
const SAND = '#f8f4ec';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background: SAND } },
    apple: { ...preset.apple, resizeOptions: { background: SAND } },
  },
  images: ['public/icon.svg'],
});
