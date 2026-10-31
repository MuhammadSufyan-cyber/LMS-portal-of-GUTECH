import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/middleware/require-auth.js', () => ({
  requireAuth: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    const role = req.header('x-test-role');
    if (!role)
      return res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    (req as import('../src/types/auth.js').AuthenticatedRequest).user = {
      id: '00000000-0000-4000-8000-000000000001',
      role: role as 'admin' | 'teacher' | 'student',
      email: 'user@gutech.edu',
      fullName: 'Test User',
      isActive: true,
      mustChangePassword: false,
    };
    return next();
  },
  requireRole:
    () =>
    (
      _req: import('express').Request,
      _res: import('express').Response,
      next: import('express').NextFunction,
    ) =>
      next(),
}));
vi.mock('../src/services/assessments.service.js', () => ({
  listAssignments: vi.fn(),
  createAssignment: vi.fn(),
  submitAssignment: vi.fn(),
  submissions: vi.fn(),
  grade: vi.fn(),
  listQuizzes: vi.fn(),
  createQuiz: vi.fn(),
  startQuiz: vi.fn(),
  submitQuiz: vi.fn(),
  quizAttempt: vi.fn(),
}));
import { app } from '../src/app.js';
import * as service from '../src/services/assessments.service.js';

const courseId = '10000000-0000-4000-8000-000000000001';
const assignmentId = '20000000-0000-4000-8000-000000000001';

describe('Phase 3 assignment endpoints', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requires authentication', async () => {
    await request(app).get(`/api/courses/${courseId}/assignments`).expect(401);
  });
  it('lists assignments for an accessible course', async () => {
    vi.mocked(service.listAssignments).mockResolvedValue([]);
    const response = await request(app)
      .get(`/api/courses/${courseId}/assignments`)
      .set('x-test-role', 'student')
      .expect(200);
    expect(response.body.data).toEqual([]);
  });
  it('validates assignment creation', async () => {
    const response = await request(app)
      .post(`/api/courses/${courseId}/assignments`)
      .set('x-test-role', 'teacher')
      .send({ title: 'x' })
      .expect(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('creates an assignment with validated input', async () => {
    vi.mocked(service.createAssignment).mockResolvedValue({
      id: assignmentId,
      title: 'Research brief',
    });
    await request(app)
      .post(`/api/courses/${courseId}/assignments`)
      .set('x-test-role', 'teacher')
      .send({
        title: 'Research brief',
        instructions: 'Explain the topic.',
        maxMarks: 20,
        dueAt: '2027-01-10T12:00:00.000Z',
        allowLate: false,
      })
      .expect(201);
    expect(service.createAssignment).toHaveBeenCalled();
  });
  it('submits a student response', async () => {
    vi.mocked(service.submitAssignment).mockResolvedValue({ id: 'submission-1' });
    await request(app)
      .post(`/api/assignments/${assignmentId}/submissions`)
      .set('x-test-role', 'student')
      .send({ textAnswer: 'My response' })
      .expect(200);
  });
  it('accepts a PDF attachment for a student submission', async () => {
    vi.mocked(service.submitAssignment).mockResolvedValue({ id: 'submission-file' });
    await request(app)
      .post(`/api/assignments/${assignmentId}/submissions`)
      .set('x-test-role', 'student')
      .attach('file', Buffer.from('%PDF-1.4 example'), {
        filename: 'work.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);
    expect(service.submitAssignment).toHaveBeenCalledWith(
      expect.anything(),
      assignmentId,
      '',
      expect.objectContaining({ originalname: 'work.pdf' }),
    );
  });
  it('rejects empty responses', async () => {
    await request(app)
      .post(`/api/assignments/${assignmentId}/submissions`)
      .set('x-test-role', 'student')
      .send({ textAnswer: ' ' })
      .expect(422);
    expect(service.submitAssignment).not.toHaveBeenCalled();
  });
  it('returns paginated submissions', async () => {
    vi.mocked(service.submissions).mockResolvedValue({ data: [], total: 0 });
    const response = await request(app)
      .get(`/api/assignments/${assignmentId}/submissions?page=2&pageSize=10`)
      .set('x-test-role', 'teacher')
      .expect(200);
    expect(response.body.meta).toMatchObject({ page: 2, pageSize: 10, total: 0 });
  });
  it('validates grading marks', async () => {
    await request(app)
      .patch('/api/submissions/30000000-0000-4000-8000-000000000001/grade')
      .set('x-test-role', 'teacher')
      .send({ marks: -1 })
      .expect(422);
  });
  it('lists quizzes without answers', async () => {
    vi.mocked(service.listQuizzes).mockResolvedValue([]);
    const response = await request(app)
      .get(`/api/courses/${courseId}/quizzes`)
      .set('x-test-role', 'student')
      .expect(200);
    expect(response.body.data).toEqual([]);
  });
  it('validates quiz question choices', async () => {
    await request(app)
      .post(`/api/courses/${courseId}/quizzes`)
      .set('x-test-role', 'teacher')
      .send({
        title: 'Quiz one',
        timeLimitMinutes: 20,
        opensAt: '2027-01-01T00:00:00.000Z',
        closesAt: '2027-01-02T00:00:00.000Z',
        questions: [],
      })
      .expect(422);
    expect(service.createQuiz).not.toHaveBeenCalled();
  });
  it('starts a student quiz attempt', async () => {
    vi.mocked(service.startQuiz).mockResolvedValue({ id: 'attempt-1' });
    await request(app)
      .post(`/api/quizzes/${assignmentId}/start`)
      .set('x-test-role', 'student')
      .expect(201);
  });
  it('validates submitted quiz answer structure', async () => {
    await request(app)
      .post(`/api/quizzes/${assignmentId}/submit`)
      .set('x-test-role', 'student')
      .send({ answers: 'invalid' })
      .expect(422);
    expect(service.submitQuiz).not.toHaveBeenCalled();
  });
});
