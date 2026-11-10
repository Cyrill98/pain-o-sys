import { eq } from 'drizzle-orm';
import type { AdminSettings, PublicSettings, SettingsPatch } from '@app/shared';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';

/** The single settings row (created by the first migration). */
export async function getSettings(): Promise<AdminSettings> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  return {
    businessName: row?.businessName ?? 'Painting Services',
    whatsappNumber: row?.whatsappNumber ?? '',
  };
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await getSettings();
  return {
    businessName: s.businessName,
    whatsappReady: s.whatsappNumber !== '',
    turnstileSiteKey: config.TURNSTILE_SITE_KEY,
  };
}

export async function updateSettings(patch: SettingsPatch): Promise<AdminSettings> {
  const values: Partial<typeof schema.settings.$inferInsert> = {};
  if (patch.businessName !== undefined) values.businessName = patch.businessName;
  if (patch.whatsappNumber !== undefined) values.whatsappNumber = patch.whatsappNumber;
  if (Object.keys(values).length > 0) {
    await db
      .insert(schema.settings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: schema.settings.id, set: values });
  }
  return getSettings();
}
