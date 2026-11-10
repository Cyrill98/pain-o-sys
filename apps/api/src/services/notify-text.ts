import type { Language } from '@app/shared';

/** Notification texts (push + email), in both languages. */
const TEXT = {
  en: {
    newRequestTitle: 'New quote request',
    newRequestBody: '{name} · {property} · {count} area(s)',
    testTitle: 'Notifications are on',
    testBody: "You'll get a notification for new quote requests.",
  },
  ms: {
    newRequestTitle: 'Permintaan sebut harga baharu',
    newRequestBody: '{name} · {property} · {count} kawasan',
    testTitle: 'Pemberitahuan diaktifkan',
    testBody: 'Anda akan menerima pemberitahuan untuk permintaan sebut harga baharu.',
  },
} as const satisfies Record<Language, Record<string, string>>;

export type TextKey = keyof (typeof TEXT)['en'];

export function text(lang: Language, key: TextKey, vars: Record<string, string | number> = {}) {
  return TEXT[lang][key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
