import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { HttpError } from '../src/utils/http-error.js';

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
      email: 'admin@gutech.edu',
      fullName: 'Demo Admin',
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

vi.mock('../src/services/auth.service.js', () => ({
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  getCurrentProfile: vi.fn(),
}));
vi.mock('../src/services/admin-users.service.js', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  editUser: vi.fn(),
  triggerPasswordReset: vi.fn(),
}));

import { app } from '../src/app.js';
import * as authService from '../src/services/auth.service.js';
import * as usersService from '../src/services/admin-users.service.js';

const profile = {
  id: '00000000-0000-4000-8000-000000000001',
  fullName: 'Demo Admin',
  username: 'demoadmin',
  email: 'admin@gutech.edu',
  role: 'admin' as const,
  rollNo: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-10-26T00:00:00Z',
};
const path = '/api/auth';

describe('Phase 1 authentication and account endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.login).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      profile,
    });
    vi.mocked(authService.refresh).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      profile,
    });
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    vi.mocked(authService.requestPasswordReset).mockResolvedValue(undefined);
    vi.mocked(authService.resetPassword).mockResolvedValue(undefined);
    vi.mocked(authService.changePassword).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    vi.mocked(authService.getCurrentProfile).mockResolvedValue(profile);
    vi.mocked(usersService.listUsers).mockResolvedValue({ data: [profile], total: 1 });
    vi.mocked(usersService.createUser).mockResolvedValue(profile);
    vi.mocked(usersService.editUser).mockResolvedValue(profile);
    vi.mocked(usersService.triggerPasswordReset).mockResolvedValue(undefined);
  });

  it('logs in with generic invalid-credential errors and an HTTP-only refresh cookie', async () => {
    const ok = await request(app)
      .post(`${path}/login`)
      .send({ email: profile.email, password: 'Temporary123' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.profile.email).toBe(profile.email);
    expect(ok.headers['set-cookie'][0]).toContain('HttpOnly');
    vi.mocked(authService.login).mockRejectedValueOnce(
      new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
    );
    const denied = await request(app)
      .post(`${path}/login`)
      .send({ email: profile.email, password: 'incorrect' });
    expect(denied.status).toBe(401);
    expect(denied.body.error.message).toBe('Invalid email or password');
  });

  it('refreshes from the secure cookie and rejects a missing cookie', async () => {
    const ok = await request(app)
      .post(`${path}/refresh`)
      .set('Cookie', 'lms_refresh=refresh-token');
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBe('new-access-token');
    expect((await request(app).post(`${path}/refresh`)).status).toBe(401);
  });

  it('logs out an authenticated session and denies anonymous logout', async () => {
    expect((await request(app).post(`${path}/logout`).set('x-test-role', 'admin')).status).toBe(
      200,
    );
    expect((await request(app).post(`${path}/logout`)).status).toBe(401);
  });

  it('returns the current profile only to an authenticated user', async () => {
    expect((await request(app).get(`${path}/me`).set('x-test-role', 'admin')).body.data).toEqual(
      profile,
    );
    expect((await request(app).get(`${path}/me`)).status).toBe(401);
  });

  it('keeps forgot-password responses neutral for existing and unknown emails', async () => {
    const ok = await request(app)
      .post(`${path}/forgot-password`)
      .send({ email: 'unknown@gutech.edu' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.message).toContain('If the account exists');
    expect((await request(app).post(`${path}/forgot-password`).send({ email: 'bad' })).status).toBe(
      422,
    );
  });

  it('accepts a valid recovery token and validates the new-password policy', async () => {
    expect(
      (
        await request(app)
          .post(`${path}/reset-password`)
          .send({ tokenHash: 't'.repeat(30), newPassword: 'CampusPass123' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`${path}/reset-password`)
          .send({ tokenHash: 'expired', newPassword: 'short' })
      ).status,
    ).toBe(422);
  });

  it('changes a password for an authenticated user and rejects anonymous requests', async () => {
    expect(
      (
        await request(app)
          .post(`${path}/change-password`)
          .set('x-test-role', 'admin')
          .send({ currentPassword: 'Temporary123', newPassword: 'CampusPass123' })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`${path}/change-password`)
          .send({ currentPassword: 'x', newPassword: 'CampusPass123' })
      ).status,
    ).toBe(401);
  });

  it('accepts usernames as login identifiers', async () => {
    const response = await request(app)
      .post(`${path}/login`)
      .send({ email: 'muhammadsufyan', password: '12345678' });
    expect(response.status).toBe(200);
    expect(authService.login).toHaveBeenCalledWith('muhammadsufyan', '12345678');
  });

  it('paginates admin user lists and blocks non-admin access', async () => {
    const ok = await request(app)
      .get('/api/admin/users?page=1&pageSize=20')
      .set('x-test-role', 'admin');
    expect(ok.status).toBe(200);
    expect(ok.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });
    expect((await request(app).get('/api/admin/users').set('x-test-role', 'teacher')).status).toBe(
      403,
    );
  });

  it('creates an account only for an administrator', async () => {
    const body = {
      fullName: 'New Student',
      username: 'newstudent',
      email: 'new@gutech.edu',
      role: 'student',
      tempPassword: 'StartHere123',
      rollNo: 'GT-0009',
    };
    expect(
      (await request(app).post('/api/admin/users').set('x-test-role', 'admin').send(body)).status,
    ).toBe(201);
    expect(
      (await request(app).post('/api/admin/users').set('x-test-role', 'student').send(body)).status,
    ).toBe(403);
  });

  it('updates and deactivates a user only for an administrator', async () => {
    const id = '00000000-0000-4000-8000-000000000002';
    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${id}`)
          .set('x-test-role', 'admin')
          .send({ isActive: false })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${id}`)
          .set('x-test-role', 'teacher')
          .send({ isActive: false })
      ).status,
    ).toBe(403);
  });

  it('sends a reset email to any account only for an administrator', async () => {
    const id = '00000000-0000-4000-8000-000000000002';
    expect(
      (await request(app).post(`/api/admin/users/${id}/reset-password`).set('x-test-role', 'admin'))
        .status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .post(`/api/admin/users/${id}/reset-password`)
          .set('x-test-role', 'student')
      ).status,
    ).toBe(403);
  });

  it('does not expose a sign-up endpoint', async () => {
    expect(
      (
        await request(app)
          .post(`${path}/signup`)
          .send({ email: profile.email, password: 'CampusPass123' })
      ).status,
    ).toBe(404);
  });
});
