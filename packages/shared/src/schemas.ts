import { z } from 'zod';

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Every API error body has this shape; `code` is translated in the frontend. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ── Auth ─────────────────────────────────────────────

export const loginRequestSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const adminSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
});
export type Admin = z.infer<typeof adminSchema>;

export const loginResponseSchema = z.object({ admin: adminSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

/** `admin` is null when signed out (200, not 401, so signed-out checks don't log errors). */
export const meResponseSchema = z.object({ admin: adminSchema.nullable() });
export type MeResponse = z.infer<typeof meResponseSchema>;
