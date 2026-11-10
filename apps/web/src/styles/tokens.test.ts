import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import tokens from './tokens.json';

// Read from disk: Vitest doesn't process CSS imports.
const css = readFileSync(path.resolve(import.meta.dirname, '../index.css'), 'utf8');

// Tenang names that are exposed under a different CSS name (see the note in index.css).
const CSS_NAME: Record<string, string> = {
  accent: 'clay',
  'on-accent': 'on-clay',
  'accent-soft': 'clay-soft',
  'accent-text': 'clay-text',
  ring: 'ring-color',
};

/** Custom properties declared directly inside a CSS block body. */
function declarations(block: string) {
  const vars: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]!] = m[2]!.trim();
  return vars;
}

const lightBlock = css.match(/\/\* ── Raw Tenang colours[\s\S]*?:root\s*{([\s\S]*?)\n}/)?.[1] ?? '';
const darkBlock =
  css.match(/@media \(prefers-color-scheme: dark\)\s*{\s*:root\s*{([\s\S]*?)\n {2}}/)?.[1] ?? '';
const themeBlock = css.match(/@theme inline\s*{([\s\S]*?)\n}/)?.[1] ?? '';

describe('index.css matches tokens.json', () => {
  const light = declarations(lightBlock);
  const dark = declarations(darkBlock);
  const theme = declarations(themeBlock);

  it.each(tokens.color.tokens.map((t) => [t.name, t.value] as const))(
    'colour %s (light + dark)',
    (name, value) => {
      const cssName = CSS_NAME[name] ?? name;
      expect(light[cssName]?.toLowerCase(), `light --${cssName}`).toBe(value.light.toLowerCase());
      expect(dark[cssName]?.toLowerCase(), `dark --${cssName}`).toBe(value.dark.toLowerCase());
    },
  );

  it.each(tokens.radius.tokens.map((t) => [t.name, t.value] as const))('%s', (name, value) => {
    expect(theme[name]).toBe(value);
  });

  it.each(tokens.type.groups.flatMap((g) => g.styles).map((s) => [s.name, s] as const))(
    'type style %s',
    (name, style) => {
      expect(theme[`text-${name}`]).toBe(style.fontSize);
      expect(theme[`text-${name}--line-height`]).toBe(style.lineHeight);
      expect(theme[`text-${name}--font-weight`]).toBe(String(style.fontWeight));
    },
  );

  it('shadow, tap size and font families', () => {
    expect(light['shadow-soft-value']).toBe(tokens.shadow.tokens[0]!.value);
    expect(theme['spacing-tap']).toBe(tokens.touch.tokens[0]!.value);
    const normalize = (s: string) => s.replace(/["']/g, '');
    expect(normalize(theme['font-sans']!)).toBe(normalize(tokens.type.families.sans));
    expect(normalize(theme['font-display']!)).toBe(normalize(tokens.type.families.display));
  });
});
