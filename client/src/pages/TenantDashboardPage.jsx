import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import BackgroundVideo from '../components/BackgroundVideo';

export default function TenantDashboardPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    preferredLocation: '',
    budgetMin: '',
    budgetMax: '',
    moveInDate: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Load existing profile
  useEffect(() => {
    client.get('/api/profile')
      .then(({ data }) => {
        setForm({
          preferredLocation: data.preferredLocation,
          budgetMin: data.budgetMin,
          budgetMax: data.budgetMax,
          moveInDate: data.moveInDate ? data.moveInDate.split('T')[0] : '',
        });
      })
      .catch(() => {
        // 404 = no profile yet, keep blank form
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setSaving(true);
    try {
      await client.put('/api/profile', form);
      setMessage({ type: 'success', text: 'Profile saved successfully! Redirecting...' });
      setTimeout(() => {
        navigate('/listings');
      }, 1000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <BackgroundVideo />
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6 relative z-0">
      <div>
        <h1 className="text-3xl font-bold text-white">My Profile</h1>
        <p className="text-gray-400 text-sm mt-1">Set your room preferences to get AI-matched listings</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Preferred Location
              </label>
              <input
                id="profile-location"
                type="text"
                required
                placeholder="e.g. Bandra West, Mumbai"
                value={form.preferredLocation}
                onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })}
                className="input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Min Budget (₹)</label>
                <input
                  id="profile-budget-min"
                  type="number"
                  required
                  min="0"
                  placeholder="5000"
                  value={form.budgetMin}
                  onChange={(e) => setForm({ ...form, budgetMin: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Max Budget (₹)</label>
                <input
                  id="profile-budget-max"
                  type="number"
                  required
                  min="0"
                  placeholder="25000"
                  value={form.budgetMax}
                  onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Desired Move-in Date</label>
              <input
                id="profile-movein-date"
                type="date"
                required
                value={form.moveInDate}
                onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
                className="input"
              />
            </div>

            {message.text && (
              <div
                className={`px-4 py-3 rounded-xl border text-sm ${
                  message.type === 'success'
                    ? 'bg-emerald-900/30 border-emerald-800 text-emerald-400'
                    : 'bg-red-900/30 border-red-800 text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              id="profile-save-btn"
              type="submit"
              disabled={saving}
              className="btn-primary py-3"
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>
      )}

      {/* Interest requests section */}
      <InterestRequestsSection />
    </div>
    </>
  );
}

function InterestRequestsSection() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/api/interest')
      .then(({ data }) => setRequests(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-gray-200">My Interest Requests</h2>
      {requests.map((req) => (
        <div key={req._id} className="card flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-200">
              {req.listingId?.location || 'Listing'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              ₹{req.listingId?.rent?.toLocaleString('en-IN')}/mo · Score: {req.scoreAtRequest}/100
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                req.status === 'accepted'
                  ? 'bg-emerald-900/50 text-emerald-400'
                  : req.status === 'declined'
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-amber-900/50 text-amber-400'
              }`}
            >
              {req.status}
            </span>
            {req.status === 'accepted' && (
              <Link to={`/chat/${req._id}`} className="btn-secondary text-xs py-1 px-3">
                Chat
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
