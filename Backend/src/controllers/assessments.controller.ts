import type { Response } from 'express';
import {
  assignmentCreateSchema,
  assignmentIdSchema,
  assignmentQuerySchema,
  gradeSchema,
  quizAnswersSchema,
  quizCreateSchema,
  submissionSchema,
} from '../schemas/assessment.schema.js';
import { uuidSchema } from '../schemas/courses.schema.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';
import * as service from '../services/assessments.service.js';

function actor(request: AuthenticatedRequest) {
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return request.user;
}
export async function list(request: AuthenticatedRequest, response: Response) {
  const courseId = uuidSchema.parse(request.params.courseId);
  response.json({ data: await service.listAssignments(actor(request), courseId) });
}
export async function create(request: AuthenticatedRequest, response: Response) {
  const courseId = uuidSchema.parse(request.params.courseId);
  response.status(201).json({
    data: await service.createAssignment(
      actor(request),
      courseId,
      assignmentCreateSchema.parse(request.body),
    ),
  });
}
export async function submit(request: AuthenticatedRequest, response: Response) {
  const id = assignmentIdSchema.parse(request.params.id);
  const input = submissionSchema.parse(request.body);
  const file = request.file;
  if (!input.textAnswer?.trim() && !file)
    throw new HttpError(422, 'SUBMISSION_REQUIRED', 'Add a response or attach a file.');
  response.json({
    data: await service.submitAssignment(
      actor(request),
      id,
      input.textAnswer ?? '',
      file ? { buffer: file.buffer, originalname: file.originalname, size: file.size } : undefined,
    ),
  });
}
export async function submissionDownload(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.submissionId);
  response.json({ data: await service.submissionDownload(actor(request), id) });
}
export async function submissions(request: AuthenticatedRequest, response: Response) {
  const id = assignmentIdSchema.parse(request.params.id);
  const query = assignmentQuerySchema.parse(request.query);
  const result = await service.submissions(actor(request), id, query.page, query.pageSize);
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}
export async function grade(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.submissionId);
  const input = gradeSchema.parse(request.body);
  response.json({ data: await service.grade(actor(request), id, input.marks, input.feedback) });
}
export async function listQuizzes(request: AuthenticatedRequest, response: Response) {
  const courseId = uuidSchema.parse(request.params.courseId);
  response.json({ data: await service.listQuizzes(actor(request), courseId) });
}
export async function createQuiz(request: AuthenticatedRequest, response: Response) {
  const courseId = uuidSchema.parse(request.params.courseId);
  response.status(201).json({
    data: await service.createQuiz(actor(request), courseId, quizCreateSchema.parse(request.body)),
  });
}
export async function startQuiz(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  response.status(201).json({ data: await service.startQuiz(actor(request), id) });
}
export async function submitQuiz(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  response.json({
    data: await service.submitQuiz(
      actor(request),
      id,
      quizAnswersSchema.parse(request.body).answers,
    ),
  });
}
export async function quizAttempt(request: AuthenticatedRequest, response: Response) {
  const id = uuidSchema.parse(request.params.id);
  response.json({ data: await service.quizAttempt(actor(request), id) });
}
