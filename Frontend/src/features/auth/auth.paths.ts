import type { Profile, UserRole } from './auth.types';

export function roleHome(role: UserRole): string {
  return role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student';
}

export function postLoginPath(profile: Profile, requestedPath?: unknown): string {
  if (profile.mustChangePassword) return '/profile';
  if (
    typeof requestedPath === 'string' &&
    requestedPath.startsWith('/') &&
    !requestedPath.startsWith('//') &&
    !requestedPath.startsWith('/\\')
  ) {
    return requestedPath;
  }
  return roleHome(profile.role);
}
