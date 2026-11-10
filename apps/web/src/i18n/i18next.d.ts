import 'i18next';
import type { defaultNS, en } from './resources';

// Type-safe translation keys: t('admin:login.title') is checked against the English JSON.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: typeof en;
  }
}
