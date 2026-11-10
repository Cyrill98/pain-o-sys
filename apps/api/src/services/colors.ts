import { asc, eq, sql } from 'drizzle-orm';
import type { Color, ColorInput, ColorPatch } from '@app/shared';
import { colorInputSchema } from '@app/shared';
import { db, schema } from '../db/index.js';
import type { z } from 'zod';

type Row = typeof schema.colors.$inferSelect;
const toColor = (r: Row): Color => ({
  id: r.id,
  name: r.name,
  code: r.code,
  hex: r.hex,
  family: r.family,
  finish: r.finish,
  collection: r.collection,
  active: r.active,
  sortOrder: r.sortOrder,
});

export async function listColors(opts: { includeHidden: boolean }): Promise<Color[]> {
  const rows = await db
    .select()
    .from(schema.colors)
    .where(opts.includeHidden ? undefined : eq(schema.colors.active, true))
    .orderBy(asc(schema.colors.sortOrder), asc(schema.colors.name));
  return rows.map(toColor);
}

async function nextSortOrder() {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${schema.colors.sortOrder}), -1)::int` })
    .from(schema.colors);
  return (row?.max ?? -1) + 1;
}

export async function createColor(input: z.output<typeof colorInputSchema>): Promise<Color> {
  const [row] = await db
    .insert(schema.colors)
    .values({ ...input, sortOrder: await nextSortOrder() })
    .returning();
  return toColor(row!);
}

export async function createColors(inputs: z.output<typeof colorInputSchema>[]): Promise<number> {
  const start = await nextSortOrder();
  const rows = await db
    .insert(schema.colors)
    .values(inputs.map((c, i) => ({ ...c, sortOrder: start + i })))
    .returning({ id: schema.colors.id });
  return rows.length;
}

export async function updateColor(id: string, patch: ColorPatch): Promise<Color | null> {
  if (Object.keys(patch).length === 0) {
    const [row] = await db.select().from(schema.colors).where(eq(schema.colors.id, id));
    return row ? toColor(row) : null;
  }
  const [row] = await db
    .update(schema.colors)
    .set(patch)
    .where(eq(schema.colors.id, id))
    .returning();
  return row ? toColor(row) : null;
}

/** Past requests keep their own copy of the color's name and HEX, so deleting is safe. */
export async function deleteColor(id: string): Promise<boolean> {
  const rows = await db.delete(schema.colors).where(eq(schema.colors.id, id)).returning();
  return rows.length > 0;
}

export type { ColorInput };
