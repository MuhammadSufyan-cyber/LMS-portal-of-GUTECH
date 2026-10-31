import { Router, type Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import * as controller from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

export const authRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (request) => {
    const email =
      typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : 'invalid';
    return `${ipKeyGenerator(request.ip ?? 'unknown')}:${email}`;
  },
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' },
  },
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (request) =>
    typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : 'invalid',
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many reset requests. Try again later.' },
  },
});

const authenticated = (request: Request): AuthenticatedRequest => request as AuthenticatedRequest;
authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler((req, res) => controller.login(authenticated(req), res)),
);
authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler((req, res) => controller.logout(authenticated(req), res)),
);
authRouter.post(
  '/refresh',
  asyncHandler((req, res) => controller.refresh(authenticated(req), res)),
);
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler((req, res) => controller.me(authenticated(req), res)),
);
authRouter.post(
  '/forgot-password',
  forgotPasswordLimiter,
  asyncHandler((req, res) => controller.forgotPassword(authenticated(req), res)),
);
authRouter.post(
  '/reset-password',
  asyncHandler((req, res) => controller.resetPassword(authenticated(req), res)),
);
authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler((req, res) => controller.changePassword(authenticated(req), res)),
);
