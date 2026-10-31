import { env } from '../config/env.js';
import { getPublicSupabase, getServiceSupabase } from '../config/supabase.js';
import {
  getProfileById,
  listProfiles,
  toApiProfile,
  updateProfile,
  writeAudit,
} from '../repositories/profile.repository.js';
import type { AuthenticatedUser, UserRole } from '../types/auth.js';
import { HttpError } from '../utils/http-error.js';

export async function listUsers(query: {
  page: number;
  pageSize: number;
  role?: UserRole;
  search?: string;
}) {
  return listProfiles(query);
}

export async function createUser(
  actor: AuthenticatedUser,
  input: {
    fullName: string;
    username: string;
    email: string;
    role: UserRole;
    tempPassword: string;
    rollNo?: string;
  },
) {
  const { data, error } = await getServiceSupabase().auth.admin.createUser({
    email: input.email,
    password: input.tempPassword,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error || !data.user)
    throw new HttpError(
      409,
      'USER_CREATE_FAILED',
      'Could not create this user. Check the email and try again.',
    );

  const { data: profile, error: profileError } = await getServiceSupabase()
    .from('profiles')
    .insert({
      id: data.user.id,
      full_name: input.fullName,
      username: input.username,
      email: input.email,
      role: input.role,
      roll_no: input.role === 'student' ? (input.rollNo ?? null) : null,
      must_change_password: true,
    })
    .select('id,full_name,username,email,role,roll_no,is_active,must_change_password,created_at')
    .single();
  if (profileError) {
    await getServiceSupabase().auth.admin.deleteUser(data.user.id);
    throw new HttpError(
      409,
      'PROFILE_CREATE_FAILED',
      'The account could not be completed. Check the email and roll number.',
    );
  }
  await writeAudit(actor.id, 'user.created', 'profile', data.user.id);
  return toApiProfile(profile as Parameters<typeof toApiProfile>[0]);
}

export async function editUser(
  actor: AuthenticatedUser,
  id: string,
  input: { fullName?: string; role?: UserRole; isActive?: boolean },
) {
  if (actor.id === id && input.isActive === false)
    throw new HttpError(
      422,
      'SELF_DEACTIVATION_BLOCKED',
      'You cannot deactivate your own account.',
    );
  if (actor.id === id && input.role && input.role !== actor.role)
    throw new HttpError(
      422,
      'SELF_ROLE_CHANGE_BLOCKED',
      'You cannot change your own account role.',
    );
  const current = await getProfileById(id);
  if (!current) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  const patch: { full_name?: string; role?: UserRole; is_active?: boolean } = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.role !== undefined) patch.role = input.role;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  const profile = await updateProfile(id, patch);
  if (input.fullName !== undefined) {
    const { error } = await getServiceSupabase().auth.admin.updateUserById(id, {
      user_metadata: { full_name: input.fullName },
    });
    if (error)
      throw new HttpError(
        502,
        'AUTH_PROFILE_SYNC_FAILED',
        'The account name could not be synchronized.',
      );
  }
  if (input.isActive === false) {
    // Disable sign-in at the application layer immediately; token middleware rejects inactive profiles.
    await writeAudit(actor.id, 'user.deactivated', 'profile', id);
  } else {
    await writeAudit(actor.id, 'user.updated', 'profile', id);
  }
  return profile;
}

export async function triggerPasswordReset(id: string) {
  const profile = await getProfileById(id);
  if (!profile) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
  const { error } = await getPublicSupabase().auth.resetPasswordForEmail(profile.email, {
    redirectTo: env.PASSWORD_RESET_REDIRECT,
  });
  if (error)
    throw new HttpError(502, 'RESET_EMAIL_FAILED', 'Could not send a password reset email.');
}
