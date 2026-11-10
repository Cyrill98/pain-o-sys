import { describe, expect, it } from 'vitest';
import { API_ERROR_CODES, CLIENT_ERROR_CODES } from '@app/shared';
import { en, ms, namespaces } from './resources';

type Tree = { [key: string]: string | Tree };

/** Flatten {a: {b: "x"}} → {"a.b": "x"}. */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') acc[path] = value;
    else Object.assign(acc, flatten(value, path));
    return acc;
  }, {});
}

const placeholders = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

describe.each(namespaces)('"%s" translations', (ns) => {
  const enFlat = flatten(en[ns] as Tree);
  const msFlat = flatten(ms[ns] as Tree);

  it('Malay has exactly the same keys as English', () => {
    expect(Object.keys(msFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries({ ...enFlat, ...msFlat })) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('uses the same {{placeholders}} in both languages', () => {
    for (const key of Object.keys(enFlat)) {
      expect(placeholders(msFlat[key] ?? ''), key).toEqual(placeholders(enFlat[key]!));
    }
  });
});

describe('error messages', () => {
  it('cover every API and client error code', () => {
    for (const code of [...API_ERROR_CODES, ...CLIENT_ERROR_CODES]) {
      expect(en.errors, code).toHaveProperty(code);
      expect(ms.errors, code).toHaveProperty(code);
    }
  });

  it('have no codes the app does not use', () => {
    const known = new Set<string>([...API_ERROR_CODES, ...CLIENT_ERROR_CODES]);
    expect(Object.keys(en.errors).filter((code) => !known.has(code))).toEqual([]);
  });
});
