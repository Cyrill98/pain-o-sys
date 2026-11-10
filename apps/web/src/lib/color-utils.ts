import { COLOR_FAMILIES, HEX_RE, type ColorFamily } from '@app/shared';
import { hexToRgb, luma } from './recolor';

/** Black or white text, whichever reads better on this color. */
export function readableOn(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return luma(r, g, b) > 150 ? '#1f2a27' : '#ffffff';
}

/** Best-guess color family from a HEX, so the admin doesn't have to pick one. */
export function guessFamily(hex: string): ColorFamily {
  if (!HEX_RE.test(hex)) return 'white';
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l > 0.9 && s < 0.35) return 'white';
  if (l < 0.12) return 'black';
  if (s < 0.12) return l > 0.9 ? 'white' : 'grey';
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (s < 0.3 && l > 0.6 && h >= 20 && h < 70) return 'beige';
  if (h >= 15 && h < 45 && l < 0.45) return 'brown';
  if (h < 15 || h >= 345) return l > 0.75 ? 'pink' : 'red';
  if (h < 45) return 'orange';
  if (h < 70) return 'yellow';
  if (h < 170) return 'green';
  if (h < 260) return 'blue';
  if (h < 300) return 'purple';
  return 'pink';
}

export { COLOR_FAMILIES };
