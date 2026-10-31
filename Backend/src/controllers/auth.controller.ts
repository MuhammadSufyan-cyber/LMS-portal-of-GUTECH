import type { Response } from 'express';
import { env } from '../config/env.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import * as authService from '../services/auth.service.js';
import {
  changePasswordSchema,
  emailSchema,
  loginSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';
import { HttpError } from '../utils/http-error.js';

const legacyRefreshCookie = 'lms_refresh';
const refreshCookieForRole = (role: string) => `lms_refresh_${role}`;
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/api/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};
function setRefreshCookie(response: Response, value: string, role: string) {
  response.cookie(refreshCookieForRole(role), value, cookieOptions);
}
function clearRefreshCookie(response: Response, role?: string) {
  const options = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
    path: '/api/auth',
  };
  if (role) response.clearCookie(refreshCookieForRole(role), options);
  response.clearCookie(legacyRefreshCookie, options);
}

export async function login(request: AuthenticatedRequest, response: Response) {
  const body = loginSchema.parse(request.body);
  const session = await authService.login(body.email, body.password);
  setRefreshCookie(response, session.refreshToken, session.profile.role);
  response.json({ data: { accessToken: session.accessToken, profile: session.profile } });
}

export async function logout(request: AuthenticatedRequest, response: Response) {
  if (!request.accessToken)
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  await authService.logout(request.accessToken);
  clearRefreshCookie(response, request.user?.role);
  response.json({ data: { message: 'Signed out.' } });
}

export async function refresh(request: AuthenticatedRequest, response: Response) {
  const requestedRole = request.get('x-lms-session-role');
  const role = ['admin', 'teacher', 'student'].includes(requestedRole ?? '')
    ? requestedRole
    : undefined;
  const token =
    (role ? request.cookies?.[refreshCookieForRole(role)] : undefined) ??
    (request.cookies?.[legacyRefreshCookie] as string | undefined);
  if (!token) throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again.');
  const session = await authService.refresh(token);
  setRefreshCookie(response, session.refreshToken, session.profile.role);
  clearRefreshCookie(response);
  response.json({ data: { accessToken: session.accessToken, profile: session.profile } });
}

export async function me(request: AuthenticatedRequest, response: Response) {
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const profile = await authService.getCurrentProfile(request.user.id);
  response.json({ data: profile });
}

export async function forgotPassword(request: AuthenticatedRequest, response: Response) {
  const { email } = emailSchema.parse(request.body);
  try {
    await authService.requestPasswordReset(email);
  } catch {
    /* Keep the response identical for configured and unknown addresses. */
  }
  response.json({
    data: { message: 'If the account exists, a password reset link has been sent.' },
  });
}

export async function resetPassword(request: AuthenticatedRequest, response: Response) {
  const body = resetPasswordSchema.parse(request.body);
  await authService.resetPassword(body.tokenHash, body.newPassword);
  clearRefreshCookie(response);
  response.json({ data: { message: 'Password updated. You can now sign in.' } });
}

export async function changePassword(request: AuthenticatedRequest, response: Response) {
  const body = changePasswordSchema.parse(request.body);
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  const session = await authService.changePassword(
    request.user,
    body.currentPassword,
    body.newPassword,
  );
  setRefreshCookie(response, session.refreshToken, request.user.role);
  response.json({ data: { message: 'Password updated.', accessToken: session.accessToken } });
}
