import { Router, type Request } from 'express';
import multer from 'multer';
import * as controller from '../controllers/resources.controller.js';
import { requireAuth, requireRole } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const resourcesRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
const authenticated = (request: Request): AuthenticatedRequest => request as AuthenticatedRequest;
resourcesRouter.get(
  '/courses/:id/resources',
  requireAuth,
  asyncHandler((req, res) => controller.list(authenticated(req), res)),
);
resourcesRouter.post(
  '/courses/:id/resources',
  requireAuth,
  requireRole('admin', 'teacher'),
  upload.single('file'),
  asyncHandler((req, res) => controller.upload(authenticated(req), res)),
);
resourcesRouter.get(
  '/resources/:id/download',
  requireAuth,
  asyncHandler((req, res) => controller.download(authenticated(req), res)),
);
resourcesRouter.delete(
  '/resources/:id',
  requireAuth,
  requireRole('admin', 'teacher'),
  asyncHandler((req, res) => controller.remove(authenticated(req), res)),
);
