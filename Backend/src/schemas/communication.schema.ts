import { z } from 'zod';
import { paginationSchema } from './courses.schema.js';
export const announcementSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(1).max(12000),
  isPinned: z.boolean().default(false),
});
export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const communicationQuerySchema = paginationSchema;
