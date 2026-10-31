import { z } from 'zod';
import { paginationSchema, uuidSchema } from './courses.schema.js';
export const complaintCreateSchema = z.object({
  courseId: uuidSchema.optional(),
  category: z.enum(['academic', 'technical', 'facility', 'conduct', 'other']),
  subject: z.string().trim().min(4).max(180),
  description: z.string().trim().min(10).max(12000),
});
export const complaintUpdateSchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved', 'rejected']),
  adminResponse: z.string().trim().max(4000).optional(),
});
export const complaintsQuerySchema = paginationSchema.extend({
  status: z.enum(['open', 'in_review', 'resolved', 'rejected']).optional(),
});
