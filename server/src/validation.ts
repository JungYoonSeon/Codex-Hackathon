import { z } from 'zod';
import { AppError } from './errors.ts';
const cm = z.number().int().positive().max(100_000);
export const roomSchema = z.object({ widthCm: cm, lengthCm: cm, heightCm: cm.optional() }).strict();
export const requestSchema = z.object({ category: z.enum(['chair', 'sofa']), description: z.string().trim().max(500) }).strict();
export const recommendationsSchema = z.object({ room: roomSchema, request: requestSchema }).strict();
export const previewSchema = recommendationsSchema.extend({
  requestId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  inputVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  optionId: z.string().regex(/^[a-z0-9-]{1,80}$/),
}).strict();
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'INVALID_INPUT', 'Check the request: use positive integer centimeter dimensions, chair or sofa, and at most 500 preference characters.');
  return result.data;
}
