import type { Response } from 'express';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdSchema,
} from '../schemas/auth.schema.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import * as adminUsers from '../services/admin-users.service.js';
import { HttpError } from '../utils/http-error.js';

function actor(request: AuthenticatedRequest) {
  if (!request.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  return request.user;
}

export async function list(request: AuthenticatedRequest, response: Response) {
  const query = listUsersQuerySchema.parse(request.query);
  const result = await adminUsers.listUsers(query);
  response.json({
    data: result.data,
    meta: { page: query.page, pageSize: query.pageSize, total: result.total },
  });
}

export async function create(request: AuthenticatedRequest, response: Response) {
  const input = createUserSchema.parse(request.body);
  const user = await adminUsers.createUser(actor(request), input);
  response.status(201).json({ data: user });
}

export async function update(request: AuthenticatedRequest, response: Response) {
  const { id } = userIdSchema.parse(request.params);
  const input = updateUserSchema.parse(request.body);
  const user = await adminUsers.editUser(actor(request), id, input);
  response.json({ data: user });
}

export async function resetPassword(request: AuthenticatedRequest, response: Response) {
  const { id } = userIdSchema.parse(request.params);
  await adminUsers.triggerPasswordReset(id);
  response.json({ data: { message: 'Password reset email sent.' } });
}
