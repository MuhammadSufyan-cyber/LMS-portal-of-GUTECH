import { Router, type Request } from 'express';
import * as controller from '../controllers/admin-users.controller.js';
import { requireAuth, requireRole } from '../middleware/require-auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth, requireRole('admin'));
const authenticated = (request: Request): AuthenticatedRequest => request as AuthenticatedRequest;
adminUsersRouter.get(
  '/',
  asyncHandler((req, res) => controller.list(authenticated(req), res)),
);
adminUsersRouter.post(
  '/',
  asyncHandler((req, res) => controller.create(authenticated(req), res)),
);
adminUsersRouter.patch(
  '/:id',
  asyncHandler((req, res) => controller.update(authenticated(req), res)),
);
adminUsersRouter.post(
  '/:id/reset-password',
  asyncHandler((req, res) => controller.resetPassword(authenticated(req), res)),
);
