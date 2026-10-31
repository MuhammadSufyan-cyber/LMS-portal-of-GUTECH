import { Router, type Request } from 'express';
import * as controller from '../controllers/communication.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
export const communicationRouter = Router();
const auth = (req: Request) => req as AuthenticatedRequest;
communicationRouter.get(
  '/courses/:courseId/announcements',
  requireAuth,
  asyncHandler((req, res) => controller.announcements(auth(req), res)),
);
communicationRouter.post(
  '/courses/:courseId/announcements',
  requireAuth,
  asyncHandler((req, res) => controller.createAnnouncement(auth(req), res)),
);
communicationRouter.post(
  '/courses/:courseId/announcements/:id/read',
  requireAuth,
  asyncHandler((req, res) => controller.markRead(auth(req), res)),
);
communicationRouter.get(
  '/courses/:courseId/messages',
  requireAuth,
  asyncHandler((req, res) => controller.messages(auth(req), res)),
);
communicationRouter.post(
  '/courses/:courseId/messages',
  requireAuth,
  asyncHandler((req, res) => controller.sendMessage(auth(req), res)),
);
