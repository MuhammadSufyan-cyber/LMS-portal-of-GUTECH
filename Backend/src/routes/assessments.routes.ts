import { Router, type Request } from 'express';
import * as controller from '../controllers/assessments.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import multer from 'multer';

export const assessmentsRouter = Router();
const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 1 },
});
const auth = (request: Request) => request as AuthenticatedRequest;
assessmentsRouter.get(
  '/courses/:courseId/assignments',
  requireAuth,
  asyncHandler((req, res) => controller.list(auth(req), res)),
);
assessmentsRouter.post(
  '/courses/:courseId/assignments',
  requireAuth,
  asyncHandler((req, res) => controller.create(auth(req), res)),
);
assessmentsRouter.get(
  '/assignments/:id/submissions',
  requireAuth,
  asyncHandler((req, res) => controller.submissions(auth(req), res)),
);
assessmentsRouter.post(
  '/assignments/:id/submissions',
  requireAuth,
  submissionUpload.single('file'),
  asyncHandler((req, res) => controller.submit(auth(req), res)),
);
assessmentsRouter.get(
  '/submissions/:submissionId/download',
  requireAuth,
  asyncHandler((req, res) => controller.submissionDownload(auth(req), res)),
);
assessmentsRouter.patch(
  '/submissions/:submissionId/grade',
  requireAuth,
  asyncHandler((req, res) => controller.grade(auth(req), res)),
);
assessmentsRouter.get(
  '/courses/:courseId/quizzes',
  requireAuth,
  asyncHandler((req, res) => controller.listQuizzes(auth(req), res)),
);
assessmentsRouter.post(
  '/courses/:courseId/quizzes',
  requireAuth,
  asyncHandler((req, res) => controller.createQuiz(auth(req), res)),
);
assessmentsRouter.get(
  '/quizzes/:id/attempt',
  requireAuth,
  asyncHandler((req, res) => controller.quizAttempt(auth(req), res)),
);
assessmentsRouter.post(
  '/quizzes/:id/start',
  requireAuth,
  asyncHandler((req, res) => controller.startQuiz(auth(req), res)),
);
assessmentsRouter.post(
  '/quizzes/:id/submit',
  requireAuth,
  asyncHandler((req, res) => controller.submitQuiz(auth(req), res)),
);
