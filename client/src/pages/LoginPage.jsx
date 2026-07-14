import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import BackgroundVideo from '../components/BackgroundVideo';

export default function LoginPage() {
  const { dispatch } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/login', form);
      dispatch({ type: 'LOGIN', payload: { user: data.user, token: data.token } });

      // Navigate based on role
      if (data.user.role === 'owner') navigate('/dashboard/owner');
      else if (data.user.role === 'admin') navigate('/admin');
      else navigate('/dashboard/tenant');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <BackgroundVideo />
      <div className="flex-1 flex items-center justify-center px-4 relative z-0 py-12">
        <div className="w-full max-w-md">
          <div className="card bg-gray-950/80 backdrop-blur-xl border-gray-800/50 shadow-2xl">
            <div className="mb-8 text-center relative">
              <Link to="/" className="absolute left-0 top-0 text-gray-500 hover:text-white transition-colors">
                <span className="text-xl">←</span>
              </Link>
              <Link to="/">
                <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-900/50 hover:bg-primary-500 transition-colors">
                  <span className="text-white font-black text-lg">RF</span>
                </div>
              </Link>
              <h1 className="text-2xl font-bold text-white">Welcome back</h1>
              <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
            </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-900/30 border border-red-800 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary py-3 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
