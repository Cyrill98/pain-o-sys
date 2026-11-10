import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, LANGUAGES } from '@app/shared';
import { langFromPath, preferredLanguage } from './detect';
import { defaultNS, namespaces, resources } from './resources';

// Start in the URL's language (or the preferred one, before redirecting) so the first paint
// is already translated. Translations are bundled, so init is synchronous.
void i18n.use(initReactI18next).init({
  resources,
  lng: langFromPath(window.location.pathname) ?? preferredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [...LANGUAGES],
  ns: namespaces,
  defaultNS,
  initAsync: false,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

export default i18n;
