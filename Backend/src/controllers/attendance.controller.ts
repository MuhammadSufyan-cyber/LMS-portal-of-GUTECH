import type { Response } from 'express';
import { paginationSchema } from '../schemas/courses.schema.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
import { listAttendance } from '../services/attendance.service.js';

export async function list(request: AuthenticatedRequest, response: Response) {
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const query = paginationSchema.parse(request.query);
  const result = await listAttendance(request.user, query.page, query.pageSize);
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
