import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import BackgroundVideo from '../components/BackgroundVideo';

export default function RegisterPage() {
  const { dispatch } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tenant' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await client.post('/api/auth/register', form);
      dispatch({ type: 'LOGIN', payload: { user: data.user, token: data.token } });

      if (data.user.role === 'owner') navigate('/dashboard/owner');
      else navigate('/dashboard/tenant');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
              <h1 className="text-2xl font-bold text-white">Create your account</h1>
              <p className="text-gray-400 text-sm mt-1">Join thousands finding their perfect home</p>
            </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
              <input
                id="register-name"
                type="text"
                required
                placeholder="Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input
                id="register-email"
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
                id="register-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {['tenant', 'owner'].map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      form.role === r
                        ? 'border-primary-500 bg-primary-900/30 text-primary-300'
                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={form.role === r}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="sr-only"
                    />
                    <span className="text-lg">{r === 'tenant' ? '🔍' : '🏠'}</span>
                    <div>
                      <div className="text-sm font-semibold capitalize">{r}</div>
                      <div className="text-xs opacity-70">
                        {r === 'tenant' ? 'Looking for a room' : 'Listing a room'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-900/30 border border-red-800 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="btn-primary py-3 mt-2"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
