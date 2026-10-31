import { env } from '../config/env.js';
import { getPublicSupabase, getServiceSupabase } from '../config/supabase.js';
import { getProfileById } from '../repositories/profile.repository.js';
import { HttpError } from '../utils/http-error.js';
import type { AuthenticatedUser } from '../types/auth.js';

const genericLoginError = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
function logLoginFailure(reason: string, identifier: string) {
  if (env.NODE_ENV === 'development') {
    // Avoid logging passwords or other request data. Keep the identifier useful for local diagnosis.
    console.warn(`[auth] Login failed (${reason}) for ${identifier.trim().toLowerCase()}`);
  }
}
function toPublicProfile(profile: NonNullable<Awaited<ReturnType<typeof getProfileById>>>) {
  return {
    id: profile.id,
    fullName: profile.full_name,
    username: profile.username,
    email: profile.email,
    role: profile.role,
    rollNo: profile.roll_no,
    isActive: profile.is_active,
    mustChangePassword: profile.must_change_password,
  };
}
async function resolveUser(userId: string) {
  const profile = await getProfileById(userId);
  if (!profile) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  if (!profile.is_active)
    throw new HttpError(
      403,
      'ACCOUNT_INACTIVE',
      'This account is inactive. Contact an administrator.',
    );
  return profile;
}

export async function login(identifier: string, password: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  let email = normalizedIdentifier;
  if (!normalizedIdentifier.includes('@')) {
    const { data: profile } = await getServiceSupabase()
      .from('profiles')
      .select('email')
      .eq('username', normalizedIdentifier)
      .maybeSingle();
    if (!profile) {
      logLoginFailure('user not found', normalizedIdentifier);
      throw genericLoginError();
    }
    email = profile.email.trim().toLowerCase();
  }
  const { data, error } = await getPublicSupabase().auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    const { data: matchingProfiles } = await getServiceSupabase()
      .from('profiles')
      .select('is_active')
      .ilike('email', email);
    if (matchingProfiles?.length) {
      logLoginFailure('password mismatch', email);
    } else {
      logLoginFailure('user not found', email);
    }
    throw genericLoginError();
  }
  let profile;
  try {
    profile = await resolveUser(data.user.id);
  } catch (error) {
    await getServiceSupabase()
      .auth.admin.signOut(data.session.access_token, 'global')
      .catch(() => undefined);
    if (error instanceof HttpError && error.code === 'ACCOUNT_INACTIVE')
      logLoginFailure('account inactive', email);
    throw error;
  }
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    profile: toPublicProfile(profile),
  };
}

export async function refresh(refreshToken: string) {
  const { data, error } = await getPublicSupabase().auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (error || !data.session || !data.user)
    throw new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again.');
  const profile = await resolveUser(data.user.id);
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    profile: toPublicProfile(profile),
  };
}

export async function logout(accessToken: string) {
  const { error } = await getServiceSupabase().auth.admin.signOut(accessToken, 'local');
  if (error) throw new HttpError(400, 'LOGOUT_FAILED', 'Could not end this session.');
}

export async function requestPasswordReset(email: string) {
  await getPublicSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: env.PASSWORD_RESET_REDIRECT,
  });
}

export async function resetPassword(tokenHash: string, newPassword: string) {
  const client = getPublicSupabase();
  const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  if (error || !data.user)
    throw new HttpError(
      400,
      'RESET_LINK_INVALID',
      'This reset link is expired or has already been used.',
    );
  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  if (updateError)
    throw new HttpError(422, 'PASSWORD_UPDATE_FAILED', 'The password could not be updated.');
  const { error: profileError } = await getServiceSupabase()
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', data.user.id);
  if (profileError)
    throw new HttpError(
      500,
      'PROFILE_UPDATE_FAILED',
      'Password changed, but the account profile could not be updated.',
    );
  await client.auth.signOut({ scope: 'others' });
}

export async function changePassword(
  user: AuthenticatedUser,
  currentPassword: string,
  newPassword: string,
) {
  const client = getPublicSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (error || !data.session)
    throw new HttpError(401, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect.');
  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  if (updateError)
    throw new HttpError(422, 'PASSWORD_UPDATE_FAILED', 'The password could not be updated.');
  const { error: profileError } = await getServiceSupabase()
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id);
  if (profileError)
    throw new HttpError(
      500,
      'PROFILE_UPDATE_FAILED',
      'Password changed, but the account profile could not be updated.',
    );
  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData.session;
  if (!session)
    throw new HttpError(
      500,
      'SESSION_REFRESH_FAILED',
      'Password changed. Sign in again to continue.',
    );
  await client.auth.signOut({ scope: 'others' });
  return { accessToken: session.access_token, refreshToken: session.refresh_token };
}

export async function getCurrentProfile(userId: string) {
  const profile = await resolveUser(userId);
  return toPublicProfile(profile);
}
