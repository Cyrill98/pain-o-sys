import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// Load the root .env in development. In production, the host provides real env vars.
try {
  process.loadEnvFile(path.join(repoRoot, '.env'));
} catch {
  // No .env file — fine.
}

const DEV_SESSION_SECRET = 'dev-only-session-secret-do-not-use-in-production';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    /** Public address of the app. Required in production (https, except localhost previews). */
    SITE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    SESSION_SECRET: z.string().optional(),
    /** Where uploaded photos are stored. Use a persistent volume in production. */
    UPLOAD_DIR: z.string().optional(),
    /** Requests and their photos older than this many days are deleted. 0 keeps everything. */
    RETENTION_DAYS: z.coerce.number().int().min(0).default(365),
    /** Cloudflare Turnstile secret. Required in production; when unset in dev/test, skipped. */
    TURNSTILE_SECRET_KEY: z.string().optional(),
    /** Web Push (VAPID). Push is off unless both keys are set. */
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    /** Admin email notifications via Resend. Off unless the key and addresses are set. */
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    ADMIN_NOTIFY_EMAIL: z.string().optional(),
    ADMIN_NOTIFY_LANG: z.enum(['en', 'ms']).default('en'),
  })
  .transform((env, ctx) => {
    const secret = env.SESSION_SECRET || (env.NODE_ENV === 'production' ? '' : DEV_SESSION_SECRET);
    if (secret.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET must be at least 32 characters (required in production)',
      });
    }
    if (env.NODE_ENV === 'production' && !env.TURNSTILE_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['TURNSTILE_SECRET_KEY'],
        message: 'TURNSTILE_SECRET_KEY is required in production (spam protection)',
      });
    }
    const siteUrl = env.SITE_URL ?? (env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
    if (env.NODE_ENV === 'production') {
      const url = siteUrl ? new URL(siteUrl) : null;
      const local = url && ['localhost', '127.0.0.1'].includes(url.hostname);
      if (!url || (url.protocol !== 'https:' && !local)) {
        ctx.addIssue({
          code: 'custom',
          path: ['SITE_URL'],
          message: 'SITE_URL must be set to the public https address in production',
        });
      }
    }
    return {
      ...env,
      SITE_URL: siteUrl,
      SESSION_SECRET: secret,
      UPLOAD_DIR: path.resolve(env.UPLOAD_DIR || path.join(repoRoot, 'data/uploads')),
      TURNSTILE_SECRET_KEY: env.TURNSTILE_SECRET_KEY || null,
    };
  });

// API_PORT wins over PORT so a PORT meant for another tool (e.g. Vite) can't clash in dev.
// Production hosts (Railway/Render) set PORT and leave API_PORT unset.
const parsed = envSchema.safeParse({
  ...process.env,
  PORT: process.env.API_PORT ?? process.env.PORT,
});
if (!parsed.success) {
  console.error('Invalid environment variables:', z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  /** Built SPA, served by Express in production. */
  webDistDir: path.join(repoRoot, 'apps/web/dist'),
};
