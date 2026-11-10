import { defineConfig } from 'vitest/config';

// Unit tests only (no database needed). The env below satisfies src/config.ts on import.
// Database tests (`*.db.test.ts`) run with `npm run test:db` (see vitest.db.config.ts).
const testEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://painting:painting@localhost:5432/painting_test',
  SITE_URL: 'http://localhost:5173',
  TURNSTILE_SECRET_KEY: '',
};

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts', '**/node_modules/**'],
    env: testEnv,
  },
});
