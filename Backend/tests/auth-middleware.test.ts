import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mockState = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('../src/config/supabase.js', () => ({
  createUserSupabase: () => ({ auth: { getUser: mockState.getUser } }),
  getServiceSupabase: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockState.maybeSingle }) }) }),
  }),
}));

import { requireAuth, requireRole } from '../src/middleware/require-auth.js';

function context(options: { authorization?: string; path?: string; baseUrl?: string } = {}) {
  const request = {
    header: (name: string) =>
      name.toLowerCase() === 'authorization' ? options.authorization : undefined,
    baseUrl: options.baseUrl ?? '/api/courses',
    path: options.path ?? '/',
  } as Request;
  const state = {
    code: 200,
    body: undefined as unknown,
    status(code: number) {
      state.code = code;
      return state;
    },
    json(body: unknown) {
      state.body = body;
      return state;
    },
  };
  return {
    request,
    response: state as unknown as Response,
    next: vi.fn() as unknown as NextFunction,
    state,
  };
}

describe('server auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.getUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
      error: null,
    });
    mockState.maybeSingle.mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        role: 'student',
        email: 'student@gutech.edu',
        full_name: 'Student One',
        is_active: true,
        must_change_password: false,
      },
      error: null,
    });
  });

  it('rejects missing and invalid bearer tokens', async () => {
    const missing = context();
    await requireAuth(missing.request, missing.response, missing.next);
    expect(missing.state.code).toBe(401);
    const invalid = context({ authorization: 'Bearer bad' });
    mockState.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') });
    await requireAuth(invalid.request, invalid.response, invalid.next);
    expect(invalid.state.code).toBe(401);
  });

  it('loads the role from the database and rejects inactive profiles', async () => {
    const active = context({ authorization: 'Bearer valid' });
    await requireAuth(active.request, active.response, active.next);
    expect((active.request as Request & { user?: { role: string } }).user?.role).toBe('student');
    expect(active.next).toHaveBeenCalledOnce();
    mockState.maybeSingle.mockResolvedValueOnce({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        role: 'student',
        email: 'student@gutech.edu',
        full_name: 'Student One',
        is_active: false,
        must_change_password: false,
      },
      error: null,
    });
    const inactive = context({ authorization: 'Bearer valid' });
    await requireAuth(inactive.request, inactive.response, inactive.next);
    expect(inactive.state.code).toBe(403);
    expect(inactive.next).not.toHaveBeenCalled();
  });

  it('forces temporary-password changes before other authenticated requests', async () => {
    mockState.maybeSingle.mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        role: 'student',
        email: 'student@gutech.edu',
        full_name: 'Student One',
        is_active: true,
        must_change_password: true,
      },
      error: null,
    });
    const blocked = context({ authorization: 'Bearer valid', baseUrl: '/api/courses' });
    await requireAuth(blocked.request, blocked.response, blocked.next);
    expect(blocked.state.code).toBe(403);
    const allowed = context({
      authorization: 'Bearer valid',
      baseUrl: '/api/auth',
      path: '/change-password',
    });
    await requireAuth(allowed.request, allowed.response, allowed.next);
    expect(allowed.next).toHaveBeenCalledOnce();
  });

  it('enforces server-side role checks', () => {
    const req = { user: { role: 'teacher' } } as Request & { user: { role: string } };
    const denied = context();
    requireRole('admin')(req, denied.response, denied.next);
    expect(denied.state.code).toBe(403);
    const passed = context();
    requireRole('teacher')(req, passed.response, passed.next);
    expect(passed.next).toHaveBeenCalledOnce();
  });
});
