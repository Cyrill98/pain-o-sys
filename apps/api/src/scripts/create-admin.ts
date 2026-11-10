/**
 * Create the admin account, or reset its password.
 *
 *   npm run create-admin -- --email mom@example.com --name "Mom"
 *   npm run create-admin -- --email mom@example.com --reset
 *
 * The password is asked for interactively (not echoed). For non-interactive use
 * (e.g. a one-off command on the host), set ADMIN_PASSWORD in the environment.
 */
import { parseArgs } from 'node:util';
import readline from 'node:readline';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, pool, schema } from '../db/index.js';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth/password.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    reset: { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    let prompted = false;
    output._writeToOutput = (s: string) => {
      // Print the prompt once, then hide what is typed.
      if (!prompted) {
        process.stdout.write(s);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function getPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) fail('No terminal for password prompt; set ADMIN_PASSWORD instead.');
  const first = await askHidden('Password: ');
  const second = await askHidden('Repeat password: ');
  if (first !== second) fail('Passwords do not match.');
  return first;
}

const email = z.email().safeParse(values.email?.trim().toLowerCase());
if (!email.success) fail('Usage: create-admin --email <email> [--name <name>] [--reset]');

const existing = await db.query.adminUsers.findFirst({
  where: eq(schema.adminUsers.email, email.data),
});

if (values.reset) {
  if (!existing) fail(`No admin with email ${email.data}.`);
} else {
  if (existing) fail(`Admin ${email.data} already exists. Use --reset to change the password.`);
  const [{ count }] = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.adminUsers)) as [{ count: number }];
  if (count > 0) fail('An admin account already exists. This app supports one admin.');
}

const password = await getPassword();
if (password.length < MIN_PASSWORD_LENGTH) {
  fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}
const passwordHash = await hashPassword(password);

if (existing) {
  await db
    .update(schema.adminUsers)
    .set({ passwordHash, ...(values.name ? { name: values.name } : {}) })
    .where(eq(schema.adminUsers.id, existing.id));
  // Sign out every device that was logged in with the old password.
  await db.execute(sql`delete from session where sess->>'adminId' = ${existing.id}`);
  console.log(`Password reset for ${email.data}. All sessions signed out.`);
} else {
  await db
    .insert(schema.adminUsers)
    .values({ email: email.data, passwordHash, name: values.name ?? null });
  console.log(`Admin ${email.data} created.`);
}

await pool.end();
