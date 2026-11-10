import type { Language } from '@app/shared';
import enAdmin from '@/locales/en/admin.json';
import enRequest from '@/locales/en/request.json';
import enCommon from '@/locales/en/common.json';
import enErrors from '@/locales/en/errors.json';
import msAdmin from '@/locales/ms/admin.json';
import msRequest from '@/locales/ms/request.json';
import msCommon from '@/locales/ms/common.json';
import msErrors from '@/locales/ms/errors.json';

/** English is the source of truth for keys (and the TypeScript types). */
export const en = { common: enCommon, request: enRequest, admin: enAdmin, errors: enErrors };

/** Malay must have exactly the same keys (checked by a test). */
export const ms = {
  common: msCommon,
  request: msRequest,
  admin: msAdmin,
  errors: msErrors,
} satisfies Record<keyof typeof en, object>;

export const resources = { en, ms } satisfies Record<Language, Record<keyof typeof en, object>>;
export const namespaces = Object.keys(en) as (keyof typeof en)[];
export const defaultNS = 'common' as const;
