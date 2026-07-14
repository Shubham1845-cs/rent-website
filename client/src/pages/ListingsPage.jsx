import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
import ListingCard from '../components/ListingCard';
import client from '../api/client';

export default function ListingsPage() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ location: '', budgetMin: '', budgetMax: '' });

  const fetchListings = useCallback(async (f) => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (f.location) params.location = f.location;
      if (f.budgetMin) params.budgetMin = f.budgetMin;
      if (f.budgetMax) params.budgetMax = f.budgetMax;

      const { data } = await client.get('/api/listings', { params });
      setListings(data);
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('complete your profile')) {
        navigate('/dashboard/tenant');
      } else {
        setError(msg || 'Failed to fetch listings');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchListings(filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilter(f) {
    setFilters(f);
    fetchListings(f);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Browse Listings</h1>
        <p className="text-gray-400 text-sm">
          Listings ranked by your AI compatibility score
        </p>
      </div>

      <FilterBar onFilter={handleFilter} />

      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Computing compatibility scores…</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="px-6 py-4 rounded-xl bg-red-900/30 border border-red-800 text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">🏠</div>
          <p className="text-lg font-medium text-gray-400">No listings found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      )}

      {!loading && !error && listings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard
              key={listing._id}
              listing={listing}
              onClick={() => navigate(`/listings/${listing._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
