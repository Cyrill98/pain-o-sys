import { z } from 'zod';
import { COLOR_FAMILIES, COLOR_FINISHES } from './constants.js';

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const hexSchema = z
  .string()
  .regex(HEX_RE)
  .transform((v) => v.toUpperCase());

export const colorSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  hex: z.string(),
  family: z.enum(COLOR_FAMILIES),
  finish: z.enum(COLOR_FINISHES),
  collection: z.string().nullable(),
  active: z.boolean(),
  sortOrder: z.number(),
});
export type Color = z.infer<typeof colorSchema>;

export const colorInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z
    .string()
    .trim()
    .max(40)
    .nullish()
    .transform((v) => v || null),
  hex: hexSchema,
  family: z.enum(COLOR_FAMILIES),
  finish: z.enum(COLOR_FINISHES).default('matt'),
  collection: z
    .string()
    .trim()
    .max(80)
    .nullish()
    .transform((v) => v || null),
  active: z.boolean().default(true),
});
export type ColorInput = z.input<typeof colorInputSchema>;

export const colorPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    code: z.string().trim().max(40).nullable(),
    hex: hexSchema,
    family: z.enum(COLOR_FAMILIES),
    finish: z.enum(COLOR_FINISHES),
    collection: z.string().trim().max(80).nullable(),
    active: z.boolean(),
    sortOrder: z.number().int().min(0).max(100000),
  })
  .partial()
  .strict();
export type ColorPatch = z.infer<typeof colorPatchSchema>;

/** CSV import: one color per row; `name,hex` required; `code,family,finish,collection` optional. */
export const colorsImportSchema = z.object({ colors: z.array(colorInputSchema).min(1).max(500) });
