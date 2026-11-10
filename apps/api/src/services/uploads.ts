import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, inArray, isNull, lt } from 'drizzle-orm';
import { IMAGE_TYPES, type ImageMime } from '@app/shared';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';

/** Detect the real image type from the first bytes (never trust the Content-Type header). */
export function sniffImage(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const fileFor = (id: string, mime: string) =>
  path.join(config.UPLOAD_DIR, `${id}.${IMAGE_TYPES[mime as ImageMime]}`);

export async function saveUpload(buf: Buffer): Promise<string | null> {
  const mime = sniffImage(buf);
  if (!mime) return null;
  const id = randomUUID();
  await fs.mkdir(config.UPLOAD_DIR, { recursive: true });
  await fs.writeFile(fileFor(id, mime), buf, { flag: 'wx' });
  await db.insert(schema.uploads).values({ id, mime, bytes: buf.length });
  return id;
}

export async function findUploadFile(id: string) {
  const row = await db.query.uploads.findFirst({ where: (u, { eq }) => eq(u.id, id) });
  if (!row) return null;
  return { path: fileFor(row.id, row.mime), mime: row.mime };
}

/** Remove photo files from disk (best effort: a missing file is fine). */
export async function removeUploadFiles(rows: { id: string; mime: string }[]) {
  await Promise.all(rows.map((r) => fs.rm(fileFor(r.id, r.mime), { force: true })));
}

/** Delete photos nobody claimed within a day (abandoned requests). */
export async function deleteOrphanUploads(now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 3600_000);
  const rows = await db
    .select()
    .from(schema.uploads)
    .where(and(isNull(schema.uploads.requestId), lt(schema.uploads.createdAt, cutoff)));
  await removeUploadFiles(rows);
  if (rows.length > 0) {
    await db.delete(schema.uploads).where(
      inArray(
        schema.uploads.id,
        rows.map((r) => r.id),
      ),
    );
  }
  return rows.length;
}
