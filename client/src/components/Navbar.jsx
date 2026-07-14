import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, dispatch } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  }

  const dashboardPath =
    user?.role === 'owner'
      ? '/dashboard/owner'
      : user?.role === 'admin'
      ? '/admin'
      : '/dashboard/tenant';

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center px-6 py-3 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-900/50 group-hover:bg-primary-500 transition-colors">
          <span className="text-white font-black text-sm">RF</span>
        </div>
        <span className="font-bold text-gray-100 text-lg hidden sm:block">
          Rent & Flatmate
        </span>
      </Link>

      {/* Nav actions */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <span className="text-sm text-gray-400 hidden md:block">
              {user.name}
              <span className="ml-2 badge-green capitalize">{user.role}</span>
            </span>

            {user.role === 'tenant' && (
              <Link to="/listings" className="btn-secondary text-xs py-2 px-3">
                Browse
              </Link>
            )}

            <Link to={dashboardPath} className="btn-secondary text-xs py-2 px-3">
              Dashboard
            </Link>

            <button onClick={handleLogout} className="btn-danger text-xs py-2 px-3">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-secondary text-xs py-2 px-3">
              Login
            </Link>
            <Link to="/register" className="btn-primary text-xs py-2 px-3">
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
