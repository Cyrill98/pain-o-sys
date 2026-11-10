import { z } from 'zod';
import { normalizePhone } from './phone.js';

/** What every visitor may know about the business. */
export const publicSettingsSchema = z.object({
  businessName: z.string(),
  /** True when the admin's WhatsApp number is set, so "send via WhatsApp" works. */
  whatsappReady: z.boolean(),
});
export type PublicSettings = z.infer<typeof publicSettingsSchema>;

export const adminSettingsSchema = z.object({
  businessName: z.string(),
  /** E.164 (+60123456789) or empty. */
  whatsappNumber: z.string(),
});
export type AdminSettings = z.infer<typeof adminSettingsSchema>;

export const settingsPatchSchema = z
  .object({
    businessName: z.string().trim().min(1).max(80),
    whatsappNumber: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === '') return '';
        const n = normalizePhone(v);
        if (!n) ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' });
        return n ?? '';
      }),
  })
  .partial()
  .strict();
export type SettingsPatch = z.input<typeof settingsPatchSchema>;
