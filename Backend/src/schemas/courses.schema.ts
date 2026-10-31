import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const courseCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
});
export const courseUpdateSchema = courseCreateSchema
  .partial()
  .extend({ isArchived: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0);
export const teacherIdsSchema = z.object({ teacherIds: z.array(uuidSchema).max(500) });
export const enrollmentSchema = z.object({ studentIds: z.array(uuidSchema).min(1).max(500) });
export const courseQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
});
export const resourceMetadataSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
});
export const resourceQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
});
export const csvBodySchema = z.string().min(1).max(1_048_576);
