import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSavedLanguage,
  langFromBrowser,
  langFromPath,
  preferredLanguage,
  saveLanguage,
  switchLanguageInPath,
} from './detect';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('langFromPath', () => {
  it.each([
    ['/ms/book', 'ms'],
    ['/en', 'en'],
    ['/fr/book', null],
    ['/', null],
    ['/admin', null],
  ])('%s → %s', (path, expected) => {
    expect(langFromPath(path)).toBe(expected);
  });
});

describe('langFromBrowser', () => {
  it.each([
    [['ms-MY', 'en-US'], 'ms'],
    [['en-GB', 'ms'], 'en'],
    [['zh-CN', 'ms-MY'], 'ms'],
    [['MS'], 'ms'],
    [['zh-CN', 'ta'], null],
    [[], null],
  ])('%j → %s', (languages, expected) => {
    expect(langFromBrowser(languages)).toBe(expected);
  });
});

describe('saved language', () => {
  it('round-trips through localStorage', () => {
    expect(getSavedLanguage()).toBeNull();
    saveLanguage('ms');
    expect(getSavedLanguage()).toBe('ms');
  });

  it('ignores invalid saved values', () => {
    localStorage.setItem('lang', 'fr');
    expect(getSavedLanguage()).toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveLanguage('ms')).not.toThrow();
    expect(getSavedLanguage()).toBeNull();
  });
});

describe('preferredLanguage', () => {
  it('prefers the saved choice over the browser language', () => {
    vi.stubGlobal('navigator', { languages: ['ms-MY'] });
    expect(preferredLanguage()).toBe('ms');
    saveLanguage('en');
    expect(preferredLanguage()).toBe('en');
  });

  it('falls back to English', () => {
    vi.stubGlobal('navigator', { languages: ['zh-CN'] });
    expect(preferredLanguage()).toBe('en');
  });
});

describe('switchLanguageInPath', () => {
  it.each([
    ['/en/admin', 'ms', '/ms/admin'],
    ['/ms', 'en', '/en'],
    ['/en/', 'ms', '/ms'],
    ['/', 'ms', '/ms'],
    ['/admin', 'ms', '/ms/admin'],
  ] as const)('%s → %s gives %s', (path, lang, expected) => {
    expect(switchLanguageInPath(path, lang)).toBe(expected);
  });
});
