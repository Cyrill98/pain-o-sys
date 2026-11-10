import { z } from 'zod';
import {
  AREA_CONDITIONS,
  AREA_TYPES,
  LANGUAGES,
  PROPERTY_TYPES,
  REQUEST_STATUSES,
} from './constants.js';

export const NAME_MAX = 80;
export const TEXT_MAX = 600;
export const MAX_AREAS = 12;

const uuid = z.uuid();

export const requestAreaInputSchema = z.object({
  areaType: z.enum(AREA_TYPES),
  /** Free label, e.g. "Master bedroom". */
  label: z.string().trim().max(60).optional(),
  exterior: z.boolean().default(false),
  sizeSqft: z.number().int().min(1).max(200_000).optional(),
  condition: z.enum(AREA_CONDITIONS).default('good'),
  furnished: z.boolean().default(false),
  colorId: uuid.nullable().default(null),
  /** Ids returned by POST /api/uploads. */
  originalPhotoId: uuid.nullable().default(null),
  snapshotId: uuid.nullable().default(null),
});
export type RequestAreaInput = z.input<typeof requestAreaInputSchema>;

/** POST /api/requests: a guest's quote request. */
export const createRequestSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().max(200).default(''),
  town: z.string().trim().max(80).default(''),
  propertyType: z.enum(PROPERTY_TYPES),
  preferredDates: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(TEXT_MAX).default(''),
  areas: z.array(requestAreaInputSchema).min(1).max(MAX_AREAS),
  lang: z.enum(LANGUAGES),
  consent: z.literal(true),
  /** Cloudflare Turnstile token (ignored when Turnstile isn't configured in development). */
  turnstileToken: z.string().max(2048).default(''),
});
export type CreateRequest = z.input<typeof createRequestSchema>;

export const createRequestResponseSchema = z.object({
  id: z.string(),
  /** Secret that lets this device report it opened WhatsApp. */
  token: z.string(),
  /** wa.me link with the message prefilled; null when the admin has no WhatsApp number set. */
  whatsappUrl: z.string().nullable(),
  /** The same message, for a copy button. */
  message: z.string(),
});
export type CreateRequestResponse = z.infer<typeof createRequestResponseSchema>;

export const openedSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

// ── Admin views ──────────────────────────────────────

export const adminAreaSchema = z.object({
  id: z.string(),
  areaType: z.enum(AREA_TYPES),
  label: z.string().nullable(),
  exterior: z.boolean(),
  sizeSqft: z.number().nullable(),
  condition: z.enum(AREA_CONDITIONS),
  furnished: z.boolean(),
  /** Snapshot of the chosen color at request time (the catalog may change later). */
  colorName: z.string().nullable(),
  colorCode: z.string().nullable(),
  colorHex: z.string().nullable(),
  originalPhotoId: z.string().nullable(),
  snapshotId: z.string().nullable(),
});
export type AdminArea = z.infer<typeof adminAreaSchema>;

export const adminRequestSummarySchema = z.object({
  id: z.string(),
  status: z.enum(REQUEST_STATUSES),
  clientName: z.string(),
  phone: z.string(),
  town: z.string(),
  propertyType: z.enum(PROPERTY_TYPES),
  areaCount: z.number(),
  whatsappOpened: z.boolean(),
  createdAt: z.string(),
});
export type AdminRequestSummary = z.infer<typeof adminRequestSummarySchema>;

export const adminRequestSchema = adminRequestSummarySchema.omit({ areaCount: true }).extend({
  address: z.string(),
  preferredDates: z.string(),
  notes: z.string(),
  adminNotes: z.string(),
  lang: z.enum(LANGUAGES),
  areas: z.array(adminAreaSchema),
});
export type AdminRequest = z.infer<typeof adminRequestSchema>;

export const requestPatchSchema = z
  .object({
    status: z.enum(REQUEST_STATUSES),
    adminNotes: z.string().max(2000),
  })
  .partial()
  .strict();
export type RequestPatch = z.infer<typeof requestPatchSchema>;
