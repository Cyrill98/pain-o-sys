import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/**
 * Migrations folder. In dev this file sits next to `migrations/`; in the bundled build
 * (dist/migrate.js) tsup copies the folder to dist/migrations.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.join(here, 'migrations');

export async function runMigrations(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

// Run directly: `npm run db:migrate`
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { config } = await import('../config.js');
  await runMigrations(config.DATABASE_URL);
  console.log('Migrations applied.');
}
