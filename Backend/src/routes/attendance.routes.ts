import { Router, type Request } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { list } from '../controllers/attendance.controller.js';

export const attendanceRouter = Router();
attendanceRouter.get(
  '/attendance',
  requireAuth,
  asyncHandler((request: Request, response) => list(request as AuthenticatedRequest, response)),
);
