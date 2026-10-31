import type { Response } from 'express';
import * as service from '../services/resources.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import {
  resourceMetadataSchema,
  resourceQuerySchema,
  uuidSchema,
} from '../schemas/courses.schema.js';
import { HttpError } from '../utils/http-error.js';

function actor(request: AuthenticatedRequest) {
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return request.user;
}

export async function list(request: AuthenticatedRequest, response: Response) {
  const user = actor(request);
  const courseId = uuidSchema.parse(request.params.id);
  const query = resourceQuerySchema.parse(request.query);
  const result = await service.listCourseResources(
    user,
    courseId,
    query.page,
    query.pageSize,
    query.search,
  );
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}

export async function upload(request: AuthenticatedRequest, response: Response) {
  const courseId = uuidSchema.parse(request.params.id);
  const metadata = resourceMetadataSchema.parse(request.body);
  const file = request.file
    ? {
        buffer: request.file.buffer,
        originalname: request.file.originalname,
        size: request.file.size,
      }
    : undefined;
  response
    .status(201)
    .json({ data: await service.uploadCourseResource(actor(request), courseId, metadata, file) });
}

export async function download(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  response.json({ data: await service.downloadResource(actor(request), id) });
}

export async function remove(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  await service.deleteResource(actor(request), id);
  response.json({ data: { message: 'Resource removed.' } });
}
