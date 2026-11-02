import { z } from 'zod';
import { HttpError } from './errors.js';
import { normalizePhone } from './util.js';

export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Invalid request',
      result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export const phone = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid Kenyan phone number' });
    return z.NEVER;
  }
  return normalized;
});

export const id = z.coerce.number().int().positive();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
/** Whole Kenyan shillings. */
export const kes = z.number().int().min(0).max(100_000_000);
export const password = z.string().min(6, 'At least 6 characters').max(100);
/** Optional free text: empty becomes null. */
export const note = z
  .string()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v.trim() : null));
