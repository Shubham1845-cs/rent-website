import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import BackgroundVideo from '../components/BackgroundVideo';

const ROOM_TYPES = ['single', 'double', 'studio'];
const FURNISHING_TYPES = ['furnished', 'unfurnished', 'partial'];

export default function OwnerDashboardPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    location: '',
    rent: '',
    availableFrom: '',
    roomType: 'single',
    furnishing: 'furnished',
  });
  const [photos, setPhotos] = useState([]);
  const [listings, setListings] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  function fetchListings() {
    client.get('/api/listings/mine')
      .then(({ data }) => setListings(data))
      .catch(() => {});
  }

  useEffect(() => { fetchListings(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess(false);
    setCreating(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      photos.forEach((f) => fd.append('photos', f));
      await client.post('/api/listings', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCreateSuccess(true);
      setForm({ location: '', rent: '', availableFrom: '', roomType: 'single', furnishing: 'furnished' });
      setPhotos([]);
      fetchListings();
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create listing');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this listing?')) return;
    await client.delete(`/api/listings/${id}`).catch(() => {});
    fetchListings();
  }

  async function handleStatusToggle(listing) {
    const newStatus = listing.status === 'filled' ? 'available' : 'filled';
    await client.patch(`/api/listings/${listing._id}/status`, { status: newStatus }).catch(() => {});
    fetchListings();
  }

  async function handleEditSave(id) {
    await client.put(`/api/listings/${id}`, editForm).catch(() => {});
    setEditingId(null);
    fetchListings();
  }

  async function handleInterestResponse(requestId, status) {
    await client.patch(`/api/interest/${requestId}`, { status }).catch(() => {});
    fetchListings();
  }

  return (
    <>
      <BackgroundVideo />
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8 relative z-0">
      <div>
        <h1 className="text-3xl font-bold text-white">Owner Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Manage your room listings and interest requests</p>
      </div>

      {/* Create listing form */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-100 mb-5">Post a New Listing</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Location</label>
            <input id="listing-location" type="text" required placeholder="e.g. Andheri West, Mumbai"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Monthly Rent (₹)</label>
              <input id="listing-rent" type="number" required min="0" placeholder="15000"
                value={form.rent} onChange={(e) => setForm({ ...form, rent: e.target.value })}
                className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Available From</label>
              <input id="listing-available-from" type="date" required
                value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })}
                className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Room Type</label>
              <select id="listing-room-type" value={form.roomType}
                onChange={(e) => setForm({ ...form, roomType: e.target.value })}
                className="input">
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Furnishing</label>
              <select id="listing-furnishing" value={form.furnishing}
                onChange={(e) => setForm({ ...form, furnishing: e.target.value })}
                className="input">
                {FURNISHING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Photos (max 10, JPEG/PNG/WebP, 5MB each)</label>
            <input id="listing-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple
              onChange={(e) => setPhotos(Array.from(e.target.files).slice(0, 10))}
              className="input file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-700 file:text-white hover:file:bg-primary-600 cursor-pointer" />
          </div>

          {createError && (
            <div className="px-4 py-3 rounded-xl bg-red-900/30 border border-red-800 text-red-400 text-sm">{createError}</div>
          )}
          {createSuccess && (
            <div className="px-4 py-3 rounded-xl bg-emerald-900/30 border border-emerald-800 text-emerald-400 text-sm">Listing created successfully!</div>
          )}

          <button id="create-listing-btn" type="submit" disabled={creating} className="btn-primary py-3">
            {creating ? 'Creating…' : 'Post Listing'}
          </button>
        </form>
      </div>

      {/* My listings */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-gray-200">My Listings ({listings.length})</h2>
        {listings.length === 0 && (
          <div className="card text-center text-gray-500 py-10">
            No listings yet. Post your first one above!
          </div>
        )}
        {listings.map((listing) => (
          <ListingRow
            key={listing._id}
            listing={listing}
            editingId={editingId}
            editForm={editForm}
            onEdit={(id) => { setEditingId(id); setEditForm({ location: listing.location, rent: listing.rent }); }}
            onEditSave={handleEditSave}
            onEditCancel={() => setEditingId(null)}
            onEditFormChange={setEditForm}
            onDelete={handleDelete}
            onStatusToggle={handleStatusToggle}
            onChatOpen={(requestId) => navigate(`/chat/${requestId}`)}
            onInterestResponse={handleInterestResponse}
          />
        ))}
      </div>
    </div>
    </>
  );
}

function ListingRow({
  listing, editingId, editForm,
  onEdit, onEditSave, onEditCancel, onEditFormChange,
  onDelete, onStatusToggle, onChatOpen, onInterestResponse,
}) {
  const [requests, setRequests] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    client.get('/api/interest')
      .then(({ data }) => setRequests(data.filter((r) => r.listingId?._id === listing._id || r.listingId === listing._id)))
      .catch(() => {});
  }, [listing._id, refreshTrigger]);

  // Wrap onInterestResponse to trigger refresh locally too
  const handleLocalInterestResponse = async (reqId, status) => {
    await onInterestResponse(reqId, status);
    setRefreshTrigger(prev => prev + 1);
  };

  const isEditing = editingId === listing._id;
  const statusColor = listing.status === 'available' ? 'badge-green' : listing.status === 'filled' ? 'badge-yellow' : 'badge-red';

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <input value={editForm.location || ''} onChange={(e) => onEditFormChange({ ...editForm, location: e.target.value })}
                placeholder="Location" className="input text-sm" />
              <input type="number" value={editForm.rent || ''} onChange={(e) => onEditFormChange({ ...editForm, rent: e.target.value })}
                placeholder="Rent" className="input text-sm" />
            </div>
          ) : (
            <>
              <p className="font-semibold text-gray-100">{listing.location}</p>
              <p className="text-sm text-primary-400 font-bold">₹{listing.rent?.toLocaleString('en-IN')}/mo</p>
              <p className="text-xs text-gray-500 capitalize">{listing.roomType} · {listing.furnishing}</p>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={statusColor}>{listing.status}</span>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button onClick={() => onEditSave(listing._id)} className="btn-primary text-xs py-1 px-3">Save</button>
                <button onClick={onEditCancel} className="btn-secondary text-xs py-1 px-3">Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => onEdit(listing._id)} className="btn-secondary text-xs py-1 px-3">Edit</button>
                <button onClick={() => onStatusToggle(listing)} className="btn-secondary text-xs py-1 px-3">
                  {listing.status === 'filled' ? 'Reopen' : 'Mark Filled'}
                </button>
                <button onClick={() => onDelete(listing._id)} className="btn-danger text-xs py-1 px-3">Delete</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Interest requests for this listing */}
      {requests.length > 0 && (
        <div className="border-t border-gray-800 pt-4">
          <p className="text-xs font-semibold text-gray-400 mb-2">Interest Requests</p>
          <div className="flex flex-col gap-2">
            {requests.map((req) => (
              <div key={req._id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2">
                <div>
                  <span className="text-sm text-gray-200">{req.tenantId?.name || 'Tenant'}</span>
                  <span className="text-xs text-gray-500 ml-2">Score: {req.scoreAtRequest}/100</span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                    req.status === 'accepted' ? 'bg-emerald-900/50 text-emerald-400' :
                    req.status === 'declined' ? 'bg-red-900/50 text-red-400' :
                    'bg-amber-900/50 text-amber-400'
                  }`}>{req.status}</span>
                  {req.status === 'pending' && (
                    <>
                      <button onClick={() => handleLocalInterestResponse(req._id, 'accepted')} className="btn-primary text-xs py-1 px-2">Accept</button>
                      <button onClick={() => handleLocalInterestResponse(req._id, 'declined')} className="btn-danger text-xs py-1 px-2">Decline</button>
                    </>
                  )}
                  {req.status === 'accepted' && (
                    <button onClick={() => onChatOpen(req._id)} className="btn-secondary text-xs py-1 px-2">Chat</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
