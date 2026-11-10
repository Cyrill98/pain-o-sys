import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '@app/shared';

const STORAGE_KEY = 'lang';

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language);
}

/** Language from the first URL segment, e.g. "/ms/book" → "ms". */
export function langFromPath(pathname: string): Language | null {
  const first = pathname.split('/')[1];
  return isLanguage(first) ? first : null;
}

/** First supported language in the browser's list, e.g. ["ms-MY", "en"] → "ms". */
export function langFromBrowser(languages: readonly string[]): Language | null {
  for (const tag of languages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLanguage(base)) return base;
  }
  return null;
}

export function getSavedLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLanguage(saved) ? saved : null;
  } catch {
    return null; // storage blocked (private mode, etc.)
  }
}

/** Remember an explicit choice from the language toggle. */
export function saveLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Not critical.
  }
}

/** For URLs without a language: saved choice, then browser setting, then English. */
export function preferredLanguage(): Language {
  const browser = typeof navigator === 'undefined' ? [] : navigator.languages;
  return getSavedLanguage() ?? langFromBrowser(browser) ?? DEFAULT_LANGUAGE;
}

/** Same path in another language: "/en/admin?x=1" → "/ms/admin?x=1". */
export function switchLanguageInPath(pathname: string, lang: Language) {
  const parts = pathname.split('/');
  if (isLanguage(parts[1])) parts[1] = lang;
  else parts.splice(1, 0, lang);
  return parts.join('/').replace(/\/$/, '') || `/${lang}`;
}
