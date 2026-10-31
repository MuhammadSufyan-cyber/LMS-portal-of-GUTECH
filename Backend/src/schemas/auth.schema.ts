import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(254).toLowerCase(),
  password: z.string().min(1).max(128),
});
export const emailSchema = z.object({ email: z.string().trim().email().max(254).toLowerCase() });
export const resetPasswordSchema = z.object({
  tokenHash: z.string().min(20).max(2048),
  newPassword: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Za-z]/, 'Use at least one letter.')
    .regex(/[0-9]/, 'Use at least one number.'),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
});
export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .toLowerCase(),
  email: z.string().trim().email().max(254).toLowerCase(),
  role: z.enum(['admin', 'teacher', 'student']),
  tempPassword: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Za-z]/)
    .regex(/[0-9]/),
  rollNo: z.string().trim().max(40).optional(),
});
export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120).optional(),
    role: z.enum(['admin', 'teacher', 'student']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  search: z.string().trim().max(100).optional(),
});
export const userIdSchema = z.object({ id: z.string().uuid() });
