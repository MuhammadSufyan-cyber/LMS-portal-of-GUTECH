import type { Response } from 'express';
import {
  announcementSchema,
  communicationQuerySchema,
  messageSchema,
} from '../schemas/communication.schema.js';
import { uuidSchema } from '../schemas/courses.schema.js';
import * as service from '../services/communication.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
function actor(req: AuthenticatedRequest) {
  if (!req.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return req.user;
}
export async function announcements(req: AuthenticatedRequest, res: Response) {
  const courseId = uuidSchema.parse(req.params.courseId);
  const query = communicationQuerySchema.parse(req.query);
  const result = await service.announcements(actor(req), courseId, query.page, query.pageSize);
  res.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
export async function createAnnouncement(req: AuthenticatedRequest, res: Response) {
  const courseId = uuidSchema.parse(req.params.courseId);
  res.status(201).json({
    data: await service.createAnnouncement(
      actor(req),
      courseId,
      announcementSchema.parse(req.body),
    ),
  });
}
export async function markRead(req: AuthenticatedRequest, res: Response) {
  const courseId = uuidSchema.parse(req.params.courseId);
  const id = uuidSchema.parse(req.params.id);
  await service.markRead(actor(req), courseId, id);
  res.json({ data: { read: true } });
}
export async function messages(req: AuthenticatedRequest, res: Response) {
  const courseId = uuidSchema.parse(req.params.courseId);
  const query = communicationQuerySchema.parse(req.query);
  const result = await service.messages(actor(req), courseId, query.page, query.pageSize);
  res.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  const courseId = uuidSchema.parse(req.params.courseId);
  const input = messageSchema.parse(req.body);
  res.status(201).json({ data: await service.sendMessage(actor(req), courseId, input.body) });
}
