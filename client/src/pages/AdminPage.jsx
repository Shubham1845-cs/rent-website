import { useState, useEffect } from 'react';
import client from '../api/client';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [tab, setTab] = useState('users');

  useEffect(() => {
    Promise.all([
      client.get('/api/admin/users'),
      client.get('/api/admin/listings'),
      client.get('/api/admin/metrics'),
    ]).then(([u, l, m]) => {
      setUsers(u.data);
      setListings(l.data);
      setMetrics(m.data);
    }).catch(() => {});
  }, []);

  async function toggleUserDelete(user) {
    const { data } = await client.patch(`/api/admin/users/${user._id}`, {
      isDeleted: !user.isDeleted,
    });
    setUsers((prev) => prev.map((u) => (u._id === data._id ? data : u)));
  }

  async function deleteListing(id) {
    if (!window.confirm('Delete this listing?')) return;
    await client.delete(`/api/admin/listings/${id}`);
    setListings((prev) =>
      prev.map((l) => (l._id === id ? { ...l, status: 'deleted' } : l))
    );
  }

  const TABS = ['users', 'listings', 'metrics'];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="text-gray-400 text-sm mt-1">Platform management and activity metrics</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl capitalize transition-colors ${
              tab === t
                ? 'bg-primary-700 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="card overflow-x-auto">
          <h2 className="text-base font-bold text-gray-200 mb-4">All Users ({users.length})</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((u) => (
                <tr key={u._id} className={u.isDeleted ? 'opacity-50' : ''}>
                  <td className="py-3 pr-4 text-gray-200">{u.name}</td>
                  <td className="py-3 pr-4 text-gray-400">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span className="badge-green capitalize">{u.role}</span>
                  </td>
                  <td className="py-3 pr-4">
                    {u.isDeleted ? (
                      <span className="badge-red">Deleted</span>
                    ) : (
                      <span className="badge-green">Active</span>
                    )}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => toggleUserDelete(u)}
                      className={u.isDeleted ? 'btn-secondary text-xs py-1 px-3' : 'btn-danger text-xs py-1 px-3'}
                    >
                      {u.isDeleted ? 'Restore' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Listings tab */}
      {tab === 'listings' && (
        <div className="card overflow-x-auto">
          <h2 className="text-base font-bold text-gray-200 mb-4">All Listings ({listings.length})</h2>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4">Location</th>
                <th className="pb-2 pr-4">Rent</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Owner</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {listings.map((l) => (
                <tr key={l._id} className={l.status === 'deleted' ? 'opacity-40' : ''}>
                  <td className="py-3 pr-4 text-gray-200 max-w-xs truncate">{l.location}</td>
                  <td className="py-3 pr-4 text-gray-400">₹{l.rent?.toLocaleString('en-IN')}</td>
                  <td className="py-3 pr-4">
                    <span className={l.status === 'available' ? 'badge-green' : l.status === 'filled' ? 'badge-yellow' : 'badge-red'}>
                      {l.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{l.ownerId?.name || '—'}</td>
                  <td className="py-3">
                    {l.status !== 'deleted' && (
                      <button onClick={() => deleteListing(l._id)} className="btn-danger text-xs py-1 px-3">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Metrics tab */}
      {tab === 'metrics' && metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard title="Users by Role" data={metrics.usersByRole} />
          <MetricCard title="Interest Requests by Status" data={metrics.interestByStatus} />
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Active Listings</h3>
            <p className="text-4xl font-extrabold text-primary-400">{metrics.activeListings}</p>
          </div>
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Messages (Last 30 Days)</h3>
            <p className="text-4xl font-extrabold text-primary-400">{metrics.messagesLast30Days}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, data }) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">{title}</h3>
      <div className="flex flex-col gap-2">
        {Object.entries(data || {}).map(([key, val]) => (
          <div key={key} className="flex justify-between items-center">
            <span className="text-gray-300 capitalize">{key}</span>
            <span className="text-primary-400 font-bold text-lg">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
