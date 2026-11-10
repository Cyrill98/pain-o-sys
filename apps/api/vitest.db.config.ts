import { defineConfig } from 'vitest/config';

// Tests that need PostgreSQL (`npm run db:up` first). They use a separate `painting_test`
// database, created and migrated automatically, and a temporary photo folder.
const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? 'postgres://painting:painting@localhost:5432/painting_test',
  SITE_URL: 'http://localhost:5173',
  TURNSTILE_SECRET_KEY: '',
  RETENTION_DAYS: '365',
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
};

// Global setup runs in this (main) process, which doesn't receive `test.env`.
Object.assign(process.env, testEnv);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.db.test.ts'],
    env: testEnv,
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Test files share one database, so run them one at a time.
    fileParallelism: false,
  },
});
