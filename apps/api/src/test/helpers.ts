import fs from 'node:fs';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { hashPassword } from '../auth/password.js';
import { db, schema } from '../db/index.js';

export const ORIGIN = 'http://localhost:5173';

/** Empty every table, keeping the settings row, and the photo folder. */
export async function resetDb() {
  await db.execute(sql`
    truncate table push_subscriptions, request_areas, uploads, requests, colors, admin_users, session
    restart identity cascade
  `);
  await db.execute(sql`delete from settings`);
  await db.execute(sql`insert into settings (id) values (1)`);
  const dir = process.env.UPLOAD_DIR!;
  for (const f of fs.readdirSync(dir)) fs.rmSync(`${dir}/${f}`, { force: true });
}

/** Bytes that start like a PNG, which is all the upload check looks at. */
export const fakePng = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

export const photoFiles = () => fs.readdirSync(process.env.UPLOAD_DIR!);

/** Supertest agent signed in as a fresh test admin. */
export async function signedInAgent(app: Parameters<typeof request.agent>[0]) {
  const email = 'owner@example.com';
  const password = 'correct-horse-1';
  await db
    .insert(schema.adminUsers)
    .values({ email, passwordHash: await hashPassword(password), name: 'Owner' });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return agent;
}

/** A minimal valid guest request body. */
export const requestBody = (areas: object[] = [{ areaType: 'living_room' }]) => ({
  name: 'Aina',
  phone: '012-345 6780',
  propertyType: 'house',
  lang: 'en',
  consent: true,
  areas,
});
