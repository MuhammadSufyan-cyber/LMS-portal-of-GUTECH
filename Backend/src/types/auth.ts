import type { Request } from 'express';

export type UserRole = 'admin' | 'teacher' | 'student';
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
  fullName: string;
  isActive: boolean;
  mustChangePassword: boolean;
}
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  accessToken?: string;
}
