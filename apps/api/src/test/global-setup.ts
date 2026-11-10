import pg from 'pg';
import { runMigrations } from '../db/migrate.js';

/** Creates the test database if needed (requires Postgres running) and applies migrations. */
export default async function setup() {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(dbName) || !dbName.endsWith('_test')) {
    throw new Error(`Refusing to use "${dbName}" as a test database (name must end in _test).`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (err) {
    throw new Error("Can't connect to Postgres for tests. Is it running? (npm run db:up)", {
      cause: err,
    });
  }
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [
      dbName,
    ]);
    if (!rowCount) await client.query(`create database "${dbName}"`);
  } finally {
    await client.end();
  }

  await runMigrations(url.toString());
}
