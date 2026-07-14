import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';

function ScoreBadge({ score }) {
  let cls = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-base font-bold ';
  if (score >= 70) cls += 'bg-emerald-900/60 text-emerald-300 border border-emerald-700';
  else if (score >= 40) cls += 'bg-amber-900/60 text-amber-300 border border-amber-700';
  else cls += 'bg-red-900/60 text-red-300 border border-red-700';
  return <span className={cls}>⭐ {score}/100 Match</span>;
}

export default function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interestStatus, setInterestStatus] = useState('idle'); // idle | loading | sent | duplicate | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    client.get(`/api/listings/${id}`)
      .then(({ data }) => setListing(data))
      .catch(() => navigate('/listings'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleExpressInterest() {
    setInterestStatus('loading');
    try {
      await client.post('/api/interest', { listingId: id });
      setInterestStatus('sent');
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('already expressed') || err.response?.status === 409) {
        setInterestStatus('duplicate');
      } else {
        setInterestStatus('error');
        setErrorMsg(msg || 'Failed to send interest');
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-500">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) return null;

  const photos = listing.photos || [];
  const availableDate = new Date(listing.availableFrom).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button
        onClick={() => navigate('/listings')}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-200 text-sm mb-6 transition-colors"
      >
        ← Back to listings
      </button>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Photos */}
        <div className="flex-1">
          {photos.length > 0 ? (
            <div className="rounded-2xl overflow-hidden bg-gray-900 border border-gray-800">
              <img
                src={photos[0]}
                alt={listing.location}
                className="w-full h-72 object-cover"
              />
              {photos.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {photos.slice(1).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Photo ${i + 2}`}
                      className="h-20 w-28 object-cover rounded-lg flex-shrink-0"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-900 border border-gray-800 h-72 flex items-center justify-center text-gray-600">
              <div className="text-center">
                <div className="text-5xl mb-2">🏠</div>
                <div className="text-sm">No photos available</div>
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="md:w-80 flex flex-col gap-4">
          <div className="card">
            <h1 className="text-xl font-bold text-white mb-1">{listing.location}</h1>
            <p className="text-3xl font-extrabold text-primary-400 mb-4">
              ₹{listing.rent.toLocaleString('en-IN')}
              <span className="text-base font-normal text-gray-400">/mo</span>
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {[
                { label: 'Room Type', value: listing.roomType },
                { label: 'Furnishing', value: listing.furnishing },
                { label: 'Available From', value: availableDate },
                { label: 'Owner', value: listing.ownerId?.name || 'N/A' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-gray-200 font-medium capitalize">{value}</span>
                </div>
              ))}
            </div>

            {listing.score !== undefined && (
              <div className="mb-4">
                <ScoreBadge score={listing.score} />
                {listing.explanation && (
                  <p className="text-xs text-gray-400 mt-2 italic">{listing.explanation}</p>
                )}
              </div>
            )}

            {/* Interest button */}
            {interestStatus === 'idle' && (
              <button id="express-interest-btn" onClick={handleExpressInterest} className="btn-primary w-full py-3">
                Express Interest
              </button>
            )}
            {interestStatus === 'loading' && (
              <button disabled className="btn-primary w-full py-3">Sending…</button>
            )}
            {interestStatus === 'sent' && (
              <div className="py-3 px-4 rounded-xl bg-emerald-900/30 border border-emerald-800 text-emerald-400 text-sm text-center font-medium">
                ✓ Interest sent! The owner will review your request.
              </div>
            )}
            {interestStatus === 'duplicate' && (
              <div className="py-3 px-4 rounded-xl bg-amber-900/30 border border-amber-800 text-amber-400 text-sm text-center font-medium">
                Already expressed interest in this listing
              </div>
            )}
            {interestStatus === 'error' && (
              <div className="py-3 px-4 rounded-xl bg-red-900/30 border border-red-800 text-red-400 text-sm text-center">
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
