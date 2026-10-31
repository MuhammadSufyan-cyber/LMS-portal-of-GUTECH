import { Router, type Request } from 'express';
import { list } from '../controllers/marks.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
export const marksRouter = Router();
marksRouter.get(
  '/me/marks',
  requireAuth,
  asyncHandler((req: Request, res) => list(req as AuthenticatedRequest, res)),
);
