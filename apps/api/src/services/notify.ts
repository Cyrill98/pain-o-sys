import type { AdminRequest, Language } from '@app/shared';
import { config } from '../config.js';
import { emailAdmin } from './email.js';
import { text } from './notify-text.js';
import { pushToAdmins } from './push.js';

/**
 * Events → push notifications to the admin's devices and an optional admin email.
 * Callers fire these after the change is saved and don't wait for them: a failed
 * notification must never fail the request itself.
 */

const adminUrl = (lang: Language, id: string) => `/${lang}/admin/requests/${id}`;
const fullUrl = (path: string) => new URL(path, config.SITE_URL).href;

function safely(task: () => Promise<unknown>) {
  return task().catch((err) => console.error('notification failed', err));
}

const PROPERTY_LABEL: Record<Language, Record<string, string>> = {
  en: {
    house: 'House',
    apartment: 'Apartment',
    office: 'Office',
    shop: 'Shop',
    industrial: 'Factory',
    other: 'Other',
  },
  ms: {
    house: 'Rumah',
    apartment: 'Apartment',
    office: 'Pejabat',
    shop: 'Kedai',
    industrial: 'Kilang',
    other: 'Lain-lain',
  },
};

function body(r: AdminRequest, lang: Language) {
  return text(lang, 'newRequestBody', {
    name: r.clientName,
    property: PROPERTY_LABEL[lang][r.propertyType] ?? r.propertyType,
    count: r.areas.length,
  });
}

export const notify = {
  /** A guest saved a quote request. */
  newRequest: (r: AdminRequest) =>
    safely(async () => {
      const emailLang = config.ADMIN_NOTIFY_LANG;
      await Promise.all([
        pushToAdmins((lang) => ({
          title: text(lang, 'newRequestTitle'),
          body: body(r, lang),
          url: adminUrl(lang, r.id),
          tag: `request-${r.id}`,
        })),
        emailAdmin({
          subject: `${text(emailLang, 'newRequestTitle')}: ${r.clientName}`,
          text: `${body(r, emailLang)}\n\n${fullUrl(adminUrl(emailLang, r.id))}`,
        }),
      ]);
    }),

  /** "Send a test notification" from the admin settings. */
  test: () =>
    pushToAdmins((lang) => ({
      title: text(lang, 'testTitle'),
      body: text(lang, 'testBody'),
      url: `/${lang}/admin`,
      tag: 'test',
    })),
};
