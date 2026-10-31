import type { Response } from 'express';
import { paginationSchema } from '../schemas/courses.schema.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
import { getMarks } from '../services/marks.service.js';
export async function list(req: AuthenticatedRequest, res: Response) {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const query = paginationSchema.parse(req.query);
  const result = await getMarks(req.user, query.page, query.pageSize);
  res.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
