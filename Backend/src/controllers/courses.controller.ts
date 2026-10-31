import type { Response } from 'express';
import * as service from '../services/courses.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import {
  courseCreateSchema,
  courseQuerySchema,
  courseUpdateSchema,
  csvBodySchema,
  enrollmentSchema,
  paginationSchema,
  teacherIdsSchema,
  uuidSchema,
} from '../schemas/courses.schema.js';
import { HttpError } from '../utils/http-error.js';

function actor(request: AuthenticatedRequest) {
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return request.user;
}

export async function listAdmin(request: AuthenticatedRequest, response: Response) {
  const query = courseQuerySchema.parse(request.query);
  const result = await service.listAdminCourses(query);
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
export async function create(request: AuthenticatedRequest, response: Response) {
  response.status(201).json({
    data: await service.createCourse(actor(request), courseCreateSchema.parse(request.body)),
  });
}
export async function update(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  response.json({
    data: await service.updateCourse(actor(request), id, courseUpdateSchema.parse(request.body)),
  });
}
export async function replaceTeachers(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  const { teacherIds } = teacherIdsSchema.parse(request.body);
  response.json({ data: await service.replaceTeachers(actor(request), id, teacherIds) });
}
export async function enroll(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  const { studentIds } = enrollmentSchema.parse(request.body);
  response.status(201).json({ data: await service.enroll(actor(request), id, studentIds) });
}
export async function importCsv(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  if (typeof request.body !== 'string')
    throw new HttpError(400, 'CSV_REQUIRED', 'Send CSV using Content-Type: text/csv.');
  response.json({
    data: await service.importStudentCsv(actor(request), id, csvBodySchema.parse(request.body)),
  });
}
export async function previewCsv(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  if (typeof request.body !== 'string')
    throw new HttpError(400, 'CSV_REQUIRED', 'Send CSV using Content-Type: text/csv.');
  response.json({ data: await service.previewStudentCsv(id, csvBodySchema.parse(request.body)) });
}
export async function unenroll(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  const studentId = uuidSchema.parse(request.params.studentId);
  await service.removeStudent(actor(request), id, studentId);
  response.json({ data: { message: 'Student unenrolled.' } });
}
export async function mine(request: AuthenticatedRequest, response: Response) {
  const user = actor(request);
  const query = paginationSchema.parse(request.query);
  const result = await service.myCourses(user.id, user.role, query.page, query.pageSize);
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}

export async function detail(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  response.json({ data: await service.getCourse(actor(request), id) });
}

export async function teachers(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  const query = paginationSchema.parse(request.query);
  const result = await service.courseMembers(id, 'teacher', query.page, query.pageSize);
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
export async function students(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  const query = paginationSchema.parse(request.query);
  const result = await service.courseMembers(id, 'student', query.page, query.pageSize);
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
