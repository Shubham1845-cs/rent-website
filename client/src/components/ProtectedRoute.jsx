import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — guards routes by auth state and optional role requirement.
 * Props:
 *   roles?: string[] — if provided, user's role must be in this list
 */
export default function ProtectedRoute({ roles }) {
  const { token, user } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
