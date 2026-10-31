import type { NextFunction, Request, Response } from 'express';
import { getServiceSupabase, createUserSupabase } from '../config/supabase.js';
import type { AuthenticatedRequest, UserRole } from '../types/auth.js';

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const header = request.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    response
      .status(401)
      .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }
  try {
    const {
      data: { user },
      error,
    } = await createUserSupabase(token).auth.getUser(token);
    if (error || !user) {
      response
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
      return;
    }
    const { data: profile, error: profileError } = await getServiceSupabase()
      .from('profiles')
      .select('id, role, email, full_name, is_active, must_change_password')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError || !profile) {
      response
        .status(401)
        .json({ error: { code: 'PROFILE_NOT_FOUND', message: 'This account is not configured.' } });
      return;
    }
    if (!profile.is_active) {
      response
        .status(403)
        .json({ error: { code: 'ACCOUNT_INACTIVE', message: 'This account is inactive.' } });
      return;
    }
    const authRequest = request as AuthenticatedRequest;
    authRequest.user = {
      id: profile.id,
      role: profile.role as UserRole,
      email: profile.email,
      fullName: profile.full_name,
      isActive: profile.is_active,
      mustChangePassword: profile.must_change_password,
    };
    authRequest.accessToken = token;
    const isAuthRoute = request.baseUrl === '/api/auth';
    const allowedDuringForcedChange =
      isAuthRoute && ['/me', '/logout', '/change-password'].includes(request.path);
    if (profile.must_change_password && !allowedDuringForcedChange) {
      response.status(403).json({
        error: {
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'Change your temporary password to continue.',
        },
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const user = (request as AuthenticatedRequest).user;
    if (!user) {
      response
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
      return;
    }
    if (!roles.includes(user.role)) {
      response.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have access to this resource.' },
      });
      return;
    }
    next();
  };
}
