import { beforeEach, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { createRequestSchema } from '@app/shared';
import { db, schema } from '../db/index.js';
import { fakePng, photoFiles, requestBody, resetDb } from '../test/helpers.js';
import { createRequest, deleteExpiredRequests, deleteRequest, getRequest } from './requests.js';
import { saveUpload } from './uploads.js';

const make = async (withPhotos = true) => {
  const photo = withPhotos ? await saveUpload(fakePng()) : null;
  const snapshot = withPhotos ? await saveUpload(fakePng()) : null;
  const body = createRequestSchema.parse(
    requestBody([
      { areaType: 'living_room', originalPhotoId: photo, snapshotId: snapshot },
      { areaType: 'fence', exterior: true },
    ]),
  );
  return createRequest(body, '127.0.0.1');
};

const rowCount = async (table: typeof schema.requests | typeof schema.uploads) =>
  (await db.select({ n: count() }).from(table))[0]!.n;

beforeEach(resetDb);

describe('deleteRequest', () => {
  it('removes the request, its areas, its photo records and its photo files', async () => {
    const { id } = await make();
    expect(photoFiles()).toHaveLength(2);
    expect(await rowCount(schema.uploads)).toBe(2);

    expect(await deleteRequest(id)).toBe(true);

    expect(await getRequest(id)).toBeNull();
    expect(await rowCount(schema.requests)).toBe(0);
    const areas = await db.select().from(schema.requestAreas);
    expect(areas).toHaveLength(0);
    expect(await rowCount(schema.uploads)).toBe(0);
    expect(photoFiles()).toHaveLength(0);
  });

  it('returns false for a request that does not exist, and leaves others alone', async () => {
    const keep = await make();
    expect(await deleteRequest('11111111-1111-4111-8111-111111111111')).toBe(false);
    expect(await getRequest(keep.id)).not.toBeNull();
    expect(photoFiles()).toHaveLength(2);
  });

  it("does not touch another request's photos", async () => {
    const a = await make();
    const b = await make();
    expect(photoFiles()).toHaveLength(4);
    await deleteRequest(a.id);
    expect(photoFiles()).toHaveLength(2);
    expect(await getRequest(b.id)).not.toBeNull();
  });
});

describe('deleteExpiredRequests', () => {
  const backdate = (id: string, days: number) =>
    db
      .update(schema.requests)
      .set({ createdAt: new Date(Date.now() - days * 24 * 3600_000) })
      .where(eq(schema.requests.id, id));

  it('deletes only requests older than the retention period, with their photos', async () => {
    const old = await make();
    const recent = await make();
    await backdate(old.id, 400);
    await backdate(recent.id, 300);

    expect(await deleteExpiredRequests(365)).toBe(1);

    expect(await getRequest(old.id)).toBeNull();
    expect(await getRequest(recent.id)).not.toBeNull();
    expect(photoFiles()).toHaveLength(2);
  });

  it('keeps everything when retention is 0', async () => {
    const old = await make();
    await backdate(old.id, 5000);
    expect(await deleteExpiredRequests(0)).toBe(0);
    expect(await getRequest(old.id)).not.toBeNull();
  });

  it('handles more requests than one batch', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await make(false);
      await backdate(r.id, 800);
    }
    expect(await deleteExpiredRequests(365)).toBe(3);
    expect(await rowCount(schema.requests)).toBe(0);
  });
});
