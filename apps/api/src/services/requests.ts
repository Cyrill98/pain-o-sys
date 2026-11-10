import { createHash, randomBytes } from 'node:crypto';
import { and, count, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import {
  normalizePhone,
  type AdminRequest,
  type AdminRequestSummary,
  type CreateRequest,
  type CreateRequestResponse,
  type RequestPatch,
  type RequestStatus,
  createRequestSchema,
} from '@app/shared';
import type { z } from 'zod';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { getSettings } from './settings.js';
import { removeUploadFiles } from './uploads.js';
import { buildWhatsappMessage, whatsappUrl } from './whatsapp-message.js';

export class RequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: 'INVALID_INPUT' | 'INVALID_PHONE' | 'NOT_FOUND',
  ) {
    super(code);
  }
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const detailUrl = (lang: string, id: string) =>
  new URL(`/${lang}/admin/requests/${id}`, config.SITE_URL).href;

type Input = z.output<typeof createRequestSchema>;

export async function createRequest(
  input: Input,
  ip: string | undefined,
): Promise<CreateRequestResponse & { id: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new RequestError(400, 'INVALID_PHONE');

  const colorIds = [...new Set(input.areas.map((a) => a.colorId).filter((x): x is string => !!x))];
  const photoIds = [
    ...new Set(
      input.areas.flatMap((a) => [a.originalPhotoId, a.snapshotId]).filter((x): x is string => !!x),
    ),
  ];

  const token = randomBytes(32).toString('base64url');

  const { id, areaRows } = await db.transaction(async (tx) => {
    // Colors: copy name/code/hex now, so the request still reads right if the catalog changes.
    const colorRows = colorIds.length
      ? await tx.select().from(schema.colors).where(inArray(schema.colors.id, colorIds))
      : [];
    if (colorRows.length !== colorIds.length) throw new RequestError(400, 'INVALID_INPUT');
    const colorById = new Map(colorRows.map((c) => [c.id, c]));

    // Photos must exist and not belong to another request yet.
    if (photoIds.length) {
      const free = await tx
        .select({ id: schema.uploads.id })
        .from(schema.uploads)
        .where(and(inArray(schema.uploads.id, photoIds), isNull(schema.uploads.requestId)));
      if (free.length !== photoIds.length) throw new RequestError(400, 'INVALID_INPUT');
    }

    const [req] = await tx
      .insert(schema.requests)
      .values({
        clientName: input.name,
        phone,
        address: input.address,
        town: input.town,
        propertyType: input.propertyType,
        preferredDates: input.preferredDates,
        notes: input.notes,
        lang: input.lang,
        tokenHash: sha256(token),
        consentAt: new Date(),
        createdIp: ip ?? null,
      })
      .returning({ id: schema.requests.id });
    const requestId = req!.id;

    const areaRows = input.areas.map((a, position) => {
      const color = a.colorId ? colorById.get(a.colorId) : undefined;
      return {
        requestId,
        position,
        areaType: a.areaType,
        label: a.label || null,
        exterior: a.exterior,
        sizeSqft: a.sizeSqft ?? null,
        condition: a.condition,
        furnished: a.furnished,
        colorId: color?.id ?? null,
        colorName: color?.name ?? null,
        colorCode: color?.code ?? null,
        colorHex: color?.hex ?? null,
        originalPhotoId: a.originalPhotoId,
        snapshotId: a.snapshotId,
      };
    });
    await tx.insert(schema.requestAreas).values(areaRows);
    if (photoIds.length) {
      await tx
        .update(schema.uploads)
        .set({ requestId })
        .where(inArray(schema.uploads.id, photoIds));
    }
    return { id: requestId, areaRows };
  });

  const settings = await getSettings();
  const message = buildWhatsappMessage({
    lang: input.lang,
    name: input.name,
    phone,
    propertyType: input.propertyType,
    address: input.address,
    town: input.town,
    preferredDates: input.preferredDates,
    notes: input.notes,
    areas: areaRows,
    detailUrl: detailUrl(input.lang, id),
  });
  return {
    id,
    token,
    message,
    whatsappUrl: settings.whatsappNumber ? whatsappUrl(settings.whatsappNumber, message) : null,
  };
}

/** The guest's device reports it opened WhatsApp. Idempotent. */
export async function markWhatsappOpened(id: string, token: string) {
  const rows = await db
    .update(schema.requests)
    .set({ whatsappOpenedAt: new Date() })
    .where(
      and(
        eq(schema.requests.id, id),
        eq(schema.requests.tokenHash, sha256(token)),
        isNull(schema.requests.whatsappOpenedAt),
      ),
    )
    .returning({ id: schema.requests.id });
  if (rows.length === 0) {
    // Either already marked, or wrong id/token. Only the latter is an error.
    const [row] = await db
      .select({ id: schema.requests.id })
      .from(schema.requests)
      .where(and(eq(schema.requests.id, id), eq(schema.requests.tokenHash, sha256(token))));
    if (!row) throw new RequestError(404, 'NOT_FOUND');
  }
}

// ── Admin ────────────────────────────────────────────

export async function listRequests(status?: RequestStatus): Promise<AdminRequestSummary[]> {
  const rows = await db
    .select({
      r: schema.requests,
      areaCount: count(schema.requestAreas.id),
    })
    .from(schema.requests)
    .leftJoin(schema.requestAreas, eq(schema.requestAreas.requestId, schema.requests.id))
    .where(status ? eq(schema.requests.status, status) : undefined)
    .groupBy(schema.requests.id)
    .orderBy(desc(schema.requests.createdAt))
    .limit(200);
  return rows.map(({ r, areaCount }) => ({
    id: r.id,
    status: r.status,
    clientName: r.clientName,
    phone: r.phone,
    town: r.town,
    propertyType: r.propertyType,
    areaCount,
    whatsappOpened: r.whatsappOpenedAt !== null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function countNew(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.requests)
    .where(eq(schema.requests.status, 'new'));
  return row!.n;
}

export async function getRequest(id: string): Promise<AdminRequest | null> {
  const r = await db.query.requests.findFirst({ where: eq(schema.requests.id, id) });
  if (!r) return null;
  const areas = await db
    .select()
    .from(schema.requestAreas)
    .where(eq(schema.requestAreas.requestId, id))
    .orderBy(schema.requestAreas.position);
  return {
    id: r.id,
    status: r.status,
    clientName: r.clientName,
    phone: r.phone,
    town: r.town,
    address: r.address,
    propertyType: r.propertyType,
    preferredDates: r.preferredDates,
    notes: r.notes,
    adminNotes: r.adminNotes,
    lang: r.lang,
    whatsappOpened: r.whatsappOpenedAt !== null,
    createdAt: r.createdAt.toISOString(),
    areas: areas.map((a) => ({
      id: a.id,
      areaType: a.areaType,
      label: a.label,
      exterior: a.exterior,
      sizeSqft: a.sizeSqft,
      condition: a.condition,
      furnished: a.furnished,
      colorName: a.colorName,
      colorCode: a.colorCode,
      colorHex: a.colorHex,
      originalPhotoId: a.originalPhotoId,
      snapshotId: a.snapshotId,
    })),
  };
}

export async function patchRequest(id: string, patch: RequestPatch) {
  if (Object.keys(patch).length > 0) {
    await db.update(schema.requests).set(patch).where(eq(schema.requests.id, id));
  }
  return getRequest(id);
}

/**
 * Permanently delete a request: its areas, its photo records (by cascade) and the photo files.
 * Returns false when there is no such request.
 */
export async function deleteRequest(id: string): Promise<boolean> {
  const photos = await db
    .select({ id: schema.uploads.id, mime: schema.uploads.mime })
    .from(schema.uploads)
    .where(eq(schema.uploads.requestId, id));
  const deleted = await db
    .delete(schema.requests)
    .where(eq(schema.requests.id, id))
    .returning({ id: schema.requests.id });
  if (deleted.length === 0) return false;
  // The database rows are gone; now remove the files. A failure here only leaves stray files.
  await removeUploadFiles(photos);
  return true;
}

export const retentionCutoff = (now: Date, days: number) =>
  new Date(now.getTime() - days * 24 * 3600_000);

/**
 * Delete requests (and their photos) older than `retentionDays`. `0` keeps everything.
 * Works in small batches; returns how many requests were deleted.
 */
export async function deleteExpiredRequests(retentionDays: number, now = new Date()) {
  if (retentionDays <= 0) return 0;
  const cutoff = retentionCutoff(now, retentionDays);
  let total = 0;
  for (;;) {
    const batch = await db
      .select({ id: schema.requests.id })
      .from(schema.requests)
      .where(lt(schema.requests.createdAt, cutoff))
      .limit(100);
    if (batch.length === 0) return total;
    for (const { id } of batch) if (await deleteRequest(id)) total++;
  }
}

export type { CreateRequest };
