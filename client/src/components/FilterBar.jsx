import { useState } from 'react';

/**
 * FilterBar — controlled search/filter inputs for listings.
 * Props:
 *   onFilter: ({ location, budgetMin, budgetMax }) => void
 */
export default function FilterBar({ onFilter }) {
  const [location, setLocation] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');

  function handleChange(field, value) {
    const next = { location, budgetMin, budgetMax, [field]: value };
    if (field === 'location') setLocation(value);
    if (field === 'budgetMin') setBudgetMin(value);
    if (field === 'budgetMax') setBudgetMax(value);
    onFilter(next);
  }

  function handleReset() {
    setLocation('');
    setBudgetMin('');
    setBudgetMax('');
    onFilter({ location: '', budgetMin: '', budgetMax: '' });
  }

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 bg-gray-900 border border-gray-800 rounded-2xl">
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs text-gray-400 mb-1 font-medium">Location</label>
        <input
          id="filter-location"
          type="text"
          placeholder="e.g. Mumbai, Bandra..."
          value={location}
          onChange={(e) => handleChange('location', e.target.value)}
          className="input"
        />
      </div>

      <div className="w-36">
        <label className="block text-xs text-gray-400 mb-1 font-medium">Min Budget (₹)</label>
        <input
          id="filter-budget-min"
          type="number"
          placeholder="0"
          value={budgetMin}
          onChange={(e) => handleChange('budgetMin', e.target.value)}
          className="input"
          min="0"
        />
      </div>

      <div className="w-36">
        <label className="block text-xs text-gray-400 mb-1 font-medium">Max Budget (₹)</label>
        <input
          id="filter-budget-max"
          type="number"
          placeholder="100000"
          value={budgetMax}
          onChange={(e) => handleChange('budgetMax', e.target.value)}
          className="input"
          min="0"
        />
      </div>

      <button onClick={handleReset} className="btn-secondary text-xs py-2.5 px-4">
        Reset
      </button>
    </div>
  );
}
