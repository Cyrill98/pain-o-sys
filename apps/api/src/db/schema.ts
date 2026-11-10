import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  inet,
  integer,
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  AREA_CONDITIONS,
  AREA_TYPES,
  COLOR_FAMILIES,
  COLOR_FINISHES,
  LANGUAGES,
  PROPERTY_TYPES,
  REQUEST_STATUSES,
  type AreaCondition,
  type AreaType,
  type ColorFamily,
  type ColorFinish,
  type Language,
  type PropertyType,
  type RequestStatus,
} from '@app/shared';

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

/** One row (id = 1): business details shown to guests. */
export const settings = pgTable(
  'settings',
  {
    id: integer('id').primaryKey().default(1),
    businessName: text('business_name').notNull().default('Painting Services'),
    /** E.164 WhatsApp number that receives quote requests; empty = not set up yet. */
    whatsappNumber: text('whatsapp_number').notNull().default(''),
  },
  (t) => [check('settings_single_row', sql`${t.id} = 1`)],
);

/** The paint palette the admin offers. */
export const colors = pgTable(
  'colors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Brand or mix code, if any. */
    code: text('code'),
    /** #RRGGBB, upper case. */
    hex: text('hex').notNull(),
    family: text('family').$type<ColorFamily>().notNull(),
    finish: text('finish').$type<ColorFinish>().notNull().default('matt'),
    collection: text('collection'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('colors_active_sort_idx').on(t.active, t.sortOrder),
    check('colors_hex', sql`${t.hex} ~ '^#[0-9A-F]{6}$'`),
    check('colors_family', sql`${t.family} in (${inList(COLOR_FAMILIES)})`),
    check('colors_finish', sql`${t.finish} in (${inList(COLOR_FINISHES)})`),
  ],
);

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: text('status').$type<RequestStatus>().notNull().default('new'),
    clientName: text('client_name').notNull(),
    /** E.164, e.g. +60123456789 */
    phone: text('phone').notNull(),
    address: text('address').notNull().default(''),
    town: text('town').notNull().default(''),
    propertyType: text('property_type').$type<PropertyType>().notNull(),
    preferredDates: text('preferred_dates').notNull().default(''),
    notes: text('notes').notNull().default(''),
    adminNotes: text('admin_notes').notNull().default(''),
    lang: text('lang').$type<Language>().notNull().default('en'),
    /** SHA-256 of the guest's secret token (lets their device report "WhatsApp opened"). */
    tokenHash: text('token_hash').notNull().unique(),
    /** Set when the guest tapped "Open WhatsApp". A tap doesn't prove the message was sent. */
    whatsappOpenedAt: timestamptz('whatsapp_opened_at'),
    consentAt: timestamptz('consent_at').notNull(),
    createdIp: inet('created_ip'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('requests_status_created_idx').on(t.status, t.createdAt),
    index('requests_created_idx').on(t.createdAt),
    check('requests_status', sql`${t.status} in (${inList(REQUEST_STATUSES)})`),
    check('requests_property_type', sql`${t.propertyType} in (${inList(PROPERTY_TYPES)})`),
    check('requests_lang', sql`${t.lang} in (${inList(LANGUAGES)})`),
  ],
);

export const requestAreas = pgTable(
  'request_areas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    areaType: text('area_type').$type<AreaType>().notNull(),
    label: text('label'),
    exterior: boolean('exterior').notNull().default(false),
    sizeSqft: integer('size_sqft'),
    condition: text('condition').$type<AreaCondition>().notNull().default('good'),
    furnished: boolean('furnished').notNull().default(false),
    /** Kept if the color is later removed from the catalog; the snapshot below stays. */
    colorId: uuid('color_id').references(() => colors.id, { onDelete: 'set null' }),
    colorName: text('color_name'),
    colorCode: text('color_code'),
    colorHex: text('color_hex'),
    originalPhotoId: uuid('original_photo_id'),
    snapshotId: uuid('snapshot_id'),
  },
  (t) => [
    index('request_areas_request_idx').on(t.requestId),
    check('request_areas_area_type', sql`${t.areaType} in (${inList(AREA_TYPES)})`),
    check('request_areas_condition', sql`${t.condition} in (${inList(AREA_CONDITIONS)})`),
  ],
);

/** Photos stored on disk (see services/uploads.ts). */
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    /** Set when a request claims the photo; unclaimed photos are deleted after a day. */
    requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [index('uploads_orphans_idx').on(t.requestId, t.createdAt)],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    keys: jsonb('keys').$type<{ p256dh: string; auth: string }>().notNull(),
    /** Language of notifications sent to this device. */
    lang: text('lang').$type<Language>().notNull().default('en'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('push_subscriptions_lang', sql`${t.lang} in (${inList(LANGUAGES)})`),
    unique('push_subscriptions_unique').on(t.endpoint, t.adminId),
  ],
);

/** Session store for connect-pg-simple (its expected shape). */
export const session = pgTable(
  'session',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { precision: 6 }).notNull(),
  },
  (t) => [index('IDX_session_expire').on(t.expire)],
);
