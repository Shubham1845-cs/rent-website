/**
 * ScoreBadge — displays an integer score 0-100 with colour coding:
 *   green  (≥70), yellow (40-69), red (<40)
 */
function ScoreBadge({ score }) {
  let cls = 'score-badge ';
  if (score >= 70) cls += 'bg-emerald-900/60 text-emerald-300 border border-emerald-700';
  else if (score >= 40) cls += 'bg-amber-900/60 text-amber-300 border border-amber-700';
  else cls += 'bg-red-900/60 text-red-300 border border-red-700';

  return (
    <span className={cls}>
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      {score}/100
    </span>
  );
}

/**
 * ListingCard — displays a single listing with optional compatibility score badge.
 * Props:
 *   listing: RoomListing object (with optional score, explanation)
 *   onClick?: () => void
 */
export default function ListingCard({ listing, onClick }) {
  const photo = listing.photos && listing.photos[0];
  const formattedRent = `₹${listing.rent.toLocaleString('en-IN')}/mo`;
  const availableDate = new Date(listing.availableFrom).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const furnishingLabel = {
    furnished: 'Furnished',
    unfurnished: 'Unfurnished',
    partial: 'Semi-furnished',
  }[listing.furnishing] || listing.furnishing;

  return (
    <div
      onClick={onClick}
      className="flex flex-col rounded-2xl overflow-hidden border border-gray-800 bg-gray-900 shadow-xl shadow-black/30 hover:border-primary-700 hover:shadow-primary-900/20 transition-all duration-200 cursor-pointer group"
    >
      {/* Photo */}
      <div className="relative h-44 bg-gray-800 overflow-hidden">
        {photo ? (
          <img
            src={photo}
            alt={listing.location}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} points="9,22 9,12 15,12 15,22" />
            </svg>
          </div>
        )}

        {/* Score badge overlay */}
        {listing.score !== undefined && (
          <div className="absolute top-2 right-2">
            <ScoreBadge score={listing.score} />
          </div>
        )}

        {/* Status chip */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-900/80 text-gray-300 capitalize">
            {listing.roomType}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-100 text-sm leading-snug line-clamp-2">
            {listing.location}
          </h3>
          <span className="text-primary-400 font-bold text-sm whitespace-nowrap">
            {formattedRent}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span>📅</span> From {availableDate}
          </span>
          <span className="flex items-center gap-1">
            <span>🛋</span> {furnishingLabel}
          </span>
        </div>

        {listing.explanation && (
          <p className="text-xs text-gray-500 line-clamp-2 mt-1 italic">
            {listing.explanation}
          </p>
        )}
      </div>
    </div>
  );
}
