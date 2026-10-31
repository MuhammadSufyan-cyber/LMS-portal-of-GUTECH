import type { Response } from 'express';
import {
  complaintCreateSchema,
  complaintsQuerySchema,
  complaintUpdateSchema,
} from '../schemas/complaints.schema.js';
import { uuidSchema } from '../schemas/courses.schema.js';
import * as service from '../services/complaints.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
function actor(req: AuthenticatedRequest) {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return req.user;
}
export async function list(req: AuthenticatedRequest, res: Response) {
  const query = complaintsQuerySchema.parse(req.query);
  const result = await service.list(actor(req), query.page, query.pageSize, query.status);
  res.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
export async function create(req: AuthenticatedRequest, res: Response) {
  res
    .status(201)
    .json({ data: await service.create(actor(req), complaintCreateSchema.parse(req.body)) });
}
export async function update(req: AuthenticatedRequest, res: Response) {
  const id = uuidSchema.parse(req.params.id);
  res.json({ data: await service.update(actor(req), id, complaintUpdateSchema.parse(req.body)) });
}
