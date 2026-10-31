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
      email: 'staff@gutech.edu',
      fullName: 'Staff One',
      isActive: true,
      mustChangePassword: false,
    };
    (req as import('../src/types/auth.js').AuthenticatedRequest).accessToken = 'access-token';
    return next();
  },
  requireRole:
    (...roles: string[]) =>
    (
      req: import('express').Request,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      const role = req.header('x-test-role');
      if (!role || !roles.includes(role))
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'You do not have access to this resource.' },
        });
      return next();
    },
}));
vi.mock('../src/services/courses.service.js', () => ({
  listAdminCourses: vi.fn(),
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  replaceTeachers: vi.fn(),
  enroll: vi.fn(),
  importStudentCsv: vi.fn(),
  previewStudentCsv: vi.fn(),
  removeStudent: vi.fn(),
  myCourses: vi.fn(),
  getCourse: vi.fn(),
  courseMembers: vi.fn(),
}));
vi.mock('../src/services/resources.service.js', () => ({
  listCourseResources: vi.fn(),
  uploadCourseResource: vi.fn(),
  downloadResource: vi.fn(),
  deleteResource: vi.fn(),
}));

import { app } from '../src/app.js';
import * as courses from '../src/services/courses.service.js';
import * as resources from '../src/services/resources.service.js';

const courseId = '10000000-0000-4000-8000-000000000001';
const studentId = '00000000-0000-4000-8000-000000000011';
const course = {
  id: courseId,
  code: 'CS101',
  title: 'Foundations of Computing',
  description: null,
  isArchived: false,
};

describe('Phase 2 courses, enrollment, and resources endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(courses.listAdminCourses).mockResolvedValue({ data: [course], total: 1 });
    vi.mocked(courses.createCourse).mockResolvedValue(course);
    vi.mocked(courses.updateCourse).mockResolvedValue({ ...course, isArchived: true });
    vi.mocked(courses.replaceTeachers).mockResolvedValue([]);
    vi.mocked(courses.enroll).mockResolvedValue({ enrolled: 1, duplicates: 0 });
    vi.mocked(courses.previewStudentCsv).mockResolvedValue({
      matched: 1,
      duplicate: 0,
      unknownEmails: [],
    });
    vi.mocked(courses.importStudentCsv).mockResolvedValue({
      matched: 1,
      enrolled: 1,
      duplicate: 0,
      unknownEmails: [],
    });
    vi.mocked(courses.removeStudent).mockResolvedValue(undefined);
    vi.mocked(courses.myCourses).mockResolvedValue({ data: [course], total: 1 });
    vi.mocked(courses.getCourse).mockResolvedValue(course);
    vi.mocked(courses.courseMembers).mockResolvedValue([]);
    vi.mocked(resources.listCourseResources).mockResolvedValue({ data: [], total: 0 });
    vi.mocked(resources.uploadCourseResource).mockResolvedValue({
      id: '20000000-0000-4000-8000-000000000001',
      title: 'Week 1',
      fileName: 'week-1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      createdAt: '2026-10-26T00:00:00Z',
    });
    vi.mocked(resources.downloadResource).mockResolvedValue({
      url: 'https://storage.test/signed',
      expiresIn: 60,
    });
    vi.mocked(resources.deleteResource).mockResolvedValue(undefined);
  });

  it('lists each user’s courses and blocks anonymous access', async () => {
    const response = await request(app)
      .get('/api/me/courses?page=1&pageSize=12')
      .set('x-test-role', 'student');
    expect(response.status).toBe(200);
    expect(response.body.meta.total).toBe(1);
    expect((await request(app).get('/api/me/courses')).status).toBe(401);
  });

  it('restricts course creation and listing to administrators', async () => {
    expect((await request(app).get('/api/admin/courses').set('x-test-role', 'admin')).status).toBe(
      200,
    );
    expect(
      (await request(app).get('/api/admin/courses').set('x-test-role', 'teacher')).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/admin/courses')
          .set('x-test-role', 'admin')
          .send({ code: 'CS101', title: 'Foundations' })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post('/api/admin/courses')
          .set('x-test-role', 'student')
          .send({ code: 'CS101', title: 'Foundations' })
      ).status,
    ).toBe(403);
  });

  it('archives courses and returns accessible course details', async () => {
    expect(
      (
        await request(app)
          .patch(`/api/admin/courses/${courseId}`)
          .set('x-test-role', 'admin')
          .send({ isArchived: true })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get(`/api/courses/${courseId}`).set('x-test-role', 'teacher')).body.data
        .code,
    ).toBe('CS101');
  });

  it('lists course rosters and replaces assigned teachers only as an administrator', async () => {
    expect(
      (
        await request(app)
          .get(`/api/admin/courses/${courseId}/teachers`)
          .set('x-test-role', 'admin')
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get(`/api/admin/courses/${courseId}/students`)
          .set('x-test-role', 'teacher')
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .put(`/api/admin/courses/${courseId}/teachers`)
          .set('x-test-role', 'admin')
          .send({ teacherIds: [] })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .put(`/api/admin/courses/${courseId}/teachers`)
          .set('x-test-role', 'teacher')
          .send({ teacherIds: [] })
      ).status,
    ).toBe(403);
  });

  it('enrolls student IDs idempotently and supports CSV preview before import', async () => {
    expect(
      (
        await request(app)
          .post(`/api/admin/courses/${courseId}/enrollments`)
          .set('x-test-role', 'admin')
          .send({ studentIds: [studentId] })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/admin/courses/${courseId}/enrollments`)
          .set('x-test-role', 'teacher')
          .send({ studentIds: [studentId] })
      ).status,
    ).toBe(403);
    const csv = 'email\nstudent@gutech.edu\n';
    expect(
      (
        await request(app)
          .post(`/api/admin/courses/${courseId}/enrollments/csv/preview`)
          .set('x-test-role', 'admin')
          .set('Content-Type', 'text/csv')
          .send(csv)
      ).body.data.matched,
    ).toBe(1);
    expect(
      (
        await request(app)
          .post(`/api/admin/courses/${courseId}/enrollments/csv`)
          .set('x-test-role', 'admin')
          .set('Content-Type', 'text/csv')
          .send(csv)
      ).body.data.enrolled,
    ).toBe(1);
  });

  it('unenrolls a student only through the admin route', async () => {
    expect(
      (
        await request(app)
          .delete(`/api/admin/courses/${courseId}/enrollments/${studentId}`)
          .set('x-test-role', 'admin')
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/api/admin/courses/${courseId}/enrollments/${studentId}`)
          .set('x-test-role', 'teacher')
      ).status,
    ).toBe(403);
  });

  it('lists resources only for authenticated course members', async () => {
    expect(
      (
        await request(app)
          .get(`/api/courses/${courseId}/resources?page=1&pageSize=20`)
          .set('x-test-role', 'student')
      ).status,
    ).toBe(200);
    expect((await request(app).get(`/api/courses/${courseId}/resources`)).status).toBe(401);
  });

  it('accepts teacher uploads and blocks student uploads', async () => {
    const upload = () =>
      request(app)
        .post(`/api/courses/${courseId}/resources`)
        .field('title', 'Week 1')
        .attach('file', Buffer.from('%PDF-1.7 sample'), 'week-1.pdf', {
          contentType: 'application/pdf',
        });
    expect((await upload().set('x-test-role', 'teacher')).status).toBe(201);
    expect((await upload().set('x-test-role', 'student')).status).toBe(403);
  });

  it('creates signed download links for members and restricts resource deletion to staff', async () => {
    expect(
      (
        await request(app)
          .get('/api/resources/20000000-0000-4000-8000-000000000001/download')
          .set('x-test-role', 'student')
      ).body.data.expiresIn,
    ).toBe(60);
    expect(
      (
        await request(app)
          .delete('/api/resources/20000000-0000-4000-8000-000000000001')
          .set('x-test-role', 'teacher')
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .delete('/api/resources/20000000-0000-4000-8000-000000000001')
          .set('x-test-role', 'student')
      ).status,
    ).toBe(403);
  });
});
