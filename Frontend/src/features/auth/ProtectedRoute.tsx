import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import type { UserRole } from './auth.types';

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { profile, ready } = useAuth();
  const location = useLocation();
  if (!ready)
    return (
      <div className="screen-state" role="status">
        <span className="loader" />
        Checking your secure session…
      </div>
    );
  if (!profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profile.mustChangePassword && location.pathname !== '/profile')
    return <Navigate to="/profile" replace />;
  if (roles && !roles.includes(profile.role)) return <Navigate to={`/${profile.role}`} replace />;
  return <Outlet />;
}
