import { Router, type Request } from 'express';
import * as controller from '../controllers/courses.controller.js';
import { requireAuth, requireRole } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const coursesRouter = Router();
const authenticated = (request: Request): AuthenticatedRequest => request as AuthenticatedRequest;
coursesRouter.get(
  '/me/courses',
  requireAuth,
  asyncHandler((req, res) => controller.mine(authenticated(req), res)),
);
coursesRouter.get(
  '/courses/:id',
  requireAuth,
  asyncHandler((req, res) => controller.detail(authenticated(req), res)),
);
coursesRouter.get(
  '/admin/courses',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.listAdmin(authenticated(req), res)),
);
coursesRouter.get(
  '/admin/courses/:id/teachers',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.teachers(authenticated(req), res)),
);
coursesRouter.get(
  '/admin/courses/:id/students',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.students(authenticated(req), res)),
);
coursesRouter.post(
  '/admin/courses',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.create(authenticated(req), res)),
);
coursesRouter.patch(
  '/admin/courses/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.update(authenticated(req), res)),
);
coursesRouter.put(
  '/admin/courses/:id/teachers',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.replaceTeachers(authenticated(req), res)),
);
coursesRouter.post(
  '/admin/courses/:id/enrollments',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.enroll(authenticated(req), res)),
);
coursesRouter.post(
  '/admin/courses/:id/enrollments/csv/preview',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.previewCsv(authenticated(req), res)),
);
coursesRouter.post(
  '/admin/courses/:id/enrollments/csv',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.importCsv(authenticated(req), res)),
);
coursesRouter.delete(
  '/admin/courses/:id/enrollments/:studentId',
  requireAuth,
  requireRole('admin'),
  asyncHandler((req, res) => controller.unenroll(authenticated(req), res)),
);
