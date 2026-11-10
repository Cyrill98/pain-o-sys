import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  ORIGIN,
  fakePng,
  photoFiles,
  requestBody,
  resetDb,
  signedInAgent,
} from '../test/helpers.js';

const app = createApp();
const post = (path: string) => request(app).post(path).set('Origin', ORIGIN);

beforeEach(resetDb);

async function uploadPhoto() {
  const res = await post('/api/uploads').set('Content-Type', 'image/png').send(fakePng());
  expect(res.status).toBe(201);
  return res.body.id as string;
}

describe('public settings', () => {
  it('shares the business name, whether WhatsApp is ready, and the spam-check site key', async () => {
    const res = await request(app).get('/api/settings/public').expect(200);
    expect(res.body).toEqual({
      businessName: 'Painting Services',
      whatsappReady: false,
      turnstileSiteKey: null, // not configured in tests
    });
  });
});

describe('guest request flow', () => {
  it('saves a request with photos and returns a WhatsApp link when the number is set', async () => {
    const admin = await signedInAgent(app);
    await admin
      .patch('/api/admin/settings')
      .set('Origin', ORIGIN)
      .send({ businessName: 'Ah Kow Painting', whatsappNumber: '012-345 6789' })
      .expect(200);

    const photo = await uploadPhoto();
    const res = await post('/api/requests').send(
      requestBody([{ areaType: 'living_room', originalPhotoId: photo }]),
    );
    expect(res.status).toBe(201);
    expect(res.body.whatsappUrl).toMatch(/^https:\/\/wa\.me\/60123456789\?text=/);
    expect(res.body.message).toContain('Name: Aina');

    const list = await admin.get('/api/admin/requests').expect(200);
    expect(list.body.requests).toHaveLength(1);
    expect(list.body.requests[0].whatsappOpened).toBe(false);

    await post(`/api/requests/${res.body.id}/opened`).send({ token: res.body.token }).expect(204);
    const detail = await admin.get(`/api/admin/requests/${res.body.id}`).expect(200);
    expect(detail.body.whatsappOpened).toBe(true);
    expect(detail.body.areas[0].originalPhotoId).toBe(photo);
  });

  it('rejects non-images, bad phone numbers and a missing consent', async () => {
    await post('/api/uploads').set('Content-Type', 'image/png').send('not an image').expect(400);
    await post('/api/requests')
      .send({ ...requestBody(), phone: 'abc' })
      .expect(400);
    await post('/api/requests')
      .send({ ...requestBody(), consent: false })
      .expect(400);
  });

  it('rejects a photo that was already used by another request', async () => {
    const photo = await uploadPhoto();
    const areas = [{ areaType: 'bedroom', originalPhotoId: photo }];
    await post('/api/requests').send(requestBody(areas)).expect(201);
    await post('/api/requests').send(requestBody(areas)).expect(400);
  });

  it('only lets the person who sent the request mark WhatsApp as opened', async () => {
    const res = await post('/api/requests').send(requestBody()).expect(201);
    await post(`/api/requests/${res.body.id}/opened`)
      .send({ token: 'a'.repeat(43) })
      .expect(404);
  });
});

describe('admin delete', () => {
  it('requires a signed-in admin', async () => {
    const res = await post('/api/requests').send(requestBody()).expect(201);
    await request(app)
      .delete(`/api/admin/requests/${res.body.id}`)
      .set('Origin', ORIGIN)
      .expect(401);
  });

  it('deletes the request and its photos, then reports 404', async () => {
    const admin = await signedInAgent(app);
    const photo = await uploadPhoto();
    const res = await post('/api/requests')
      .send(requestBody([{ areaType: 'living_room', originalPhotoId: photo }]))
      .expect(201);
    expect(photoFiles()).toHaveLength(1);

    await admin.delete(`/api/admin/requests/${res.body.id}`).set('Origin', ORIGIN).expect(204);
    expect(photoFiles()).toHaveLength(0);
    await admin.get(`/api/admin/requests/${res.body.id}`).expect(404);
    await admin.get(`/api/admin/uploads/${photo}`).expect(404);
    await admin.delete(`/api/admin/requests/${res.body.id}`).set('Origin', ORIGIN).expect(404);
  });

  it('answers 404 for a malformed id', async () => {
    const admin = await signedInAgent(app);
    await admin.delete('/api/admin/requests/not-an-id').set('Origin', ORIGIN).expect(404);
  });
});
