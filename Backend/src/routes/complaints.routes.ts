import { Router, type Request } from 'express';
import * as controller from '../controllers/complaints.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
export const complaintsRouter = Router();
const auth = (req: Request) => req as AuthenticatedRequest;
complaintsRouter.get(
  '/',
  requireAuth,
  asyncHandler((req, res) => controller.list(auth(req), res)),
);
complaintsRouter.post(
  '/',
  requireAuth,
  asyncHandler((req, res) => controller.create(auth(req), res)),
);
complaintsRouter.patch(
  '/:id',
  requireAuth,
  asyncHandler((req, res) => controller.update(auth(req), res)),
);
