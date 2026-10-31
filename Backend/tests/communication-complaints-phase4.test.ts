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
      email: 'u@gutech.edu',
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
vi.mock('../src/services/communication.service.js', () => ({
  announcements: vi.fn(),
  createAnnouncement: vi.fn(),
  markRead: vi.fn(),
  messages: vi.fn(),
  sendMessage: vi.fn(),
}));
vi.mock('../src/services/complaints.service.js', () => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
import { app } from '../src/app.js';
import * as communication from '../src/services/communication.service.js';
import * as complaints from '../src/services/complaints.service.js';
const courseId = '10000000-0000-4000-8000-000000000001';

describe('Phase 4 communication and complaint endpoints', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requires auth for course chat', async () => {
    await request(app).get(`/api/courses/${courseId}/messages`).expect(401);
  });
  it('returns paginated course messages', async () => {
    vi.mocked(communication.messages).mockResolvedValue({ data: [], total: 0 });
    const response = await request(app)
      .get(`/api/courses/${courseId}/messages?page=2&pageSize=10`)
      .set('x-test-role', 'student')
      .expect(200);
    expect(response.body.meta).toMatchObject({ page: 2, pageSize: 10, total: 0 });
  });
  it('validates chat message length', async () => {
    await request(app)
      .post(`/api/courses/${courseId}/messages`)
      .set('x-test-role', 'student')
      .send({ body: '' })
      .expect(422);
    expect(communication.sendMessage).not.toHaveBeenCalled();
  });
  it('creates a course announcement', async () => {
    vi.mocked(communication.createAnnouncement).mockResolvedValue({ id: 'announcement-1' });
    await request(app)
      .post(`/api/courses/${courseId}/announcements`)
      .set('x-test-role', 'teacher')
      .send({ title: 'Room change', body: 'The class is in room 4 today.', isPinned: false })
      .expect(201);
  });
  it('requires auth for complaint submission', async () => {
    await request(app).post('/api/complaints').send({}).expect(401);
  });
  it('validates complaint input', async () => {
    await request(app)
      .post('/api/complaints')
      .set('x-test-role', 'student')
      .send({ category: 'academic', subject: 'bad', description: 'short' })
      .expect(422);
    expect(complaints.create).not.toHaveBeenCalled();
  });
  it('creates a student complaint', async () => {
    vi.mocked(complaints.create).mockResolvedValue({ id: 'complaint-1', status: 'open' });
    await request(app)
      .post('/api/complaints')
      .set('x-test-role', 'student')
      .send({
        category: 'academic',
        subject: 'Course schedule conflict',
        description: 'I have a conflict with the current course schedule.',
      })
      .expect(201);
  });
  it('returns paginated complaint list', async () => {
    vi.mocked(complaints.list).mockResolvedValue({ data: [], total: 0 });
    const response = await request(app)
      .get('/api/complaints?page=1&pageSize=25')
      .set('x-test-role', 'admin')
      .expect(200);
    expect(response.body.meta.total).toBe(0);
  });
  it('validates complaint status updates', async () => {
    await request(app)
      .patch('/api/complaints/30000000-0000-4000-8000-000000000001')
      .set('x-test-role', 'admin')
      .send({ status: 'done' })
      .expect(422);
    expect(complaints.update).not.toHaveBeenCalled();
  });
});
