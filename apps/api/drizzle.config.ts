import path from 'node:path';
import { defineConfig } from 'drizzle-kit';

try {
  // drizzle-kit runs from apps/api (via the npm workspace scripts).
  process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));
} catch {
  // No .env — rely on the environment.
}

// Only `generate` and `migrate` are used. Never `push`: hand-written migrations (seed rows) aren't known to Drizzle.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
});
