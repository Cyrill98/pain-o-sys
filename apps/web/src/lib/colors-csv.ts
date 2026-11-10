import { COLOR_FINISHES, HEX_RE, type ColorFinish, type ColorInput } from '@app/shared';
import { guessFamily } from './color-utils';

/** Parse "name, #hex, code, finish, collection" lines. Returns valid colors and a skip count. */
export function parseCsv(text: string): { colors: ColorInput[]; skipped: number } {
  const colors: ColorInput[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, hexRaw, code, finish, collection] = line.split(',').map((s) => s.trim());
    const hex = hexRaw ? (hexRaw.startsWith('#') ? hexRaw : `#${hexRaw}`) : '';
    if (!name || !HEX_RE.test(hex)) {
      skipped++;
      continue;
    }
    colors.push({
      name,
      hex,
      code: code || null,
      family: guessFamily(hex),
      finish: (COLOR_FINISHES as readonly string[]).includes(finish ?? '')
        ? (finish as ColorFinish)
        : 'matt',
      collection: collection || null,
    });
  }
  return { colors, skipped };
}
