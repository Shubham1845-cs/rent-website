import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BackgroundVideo from '../components/BackgroundVideo';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <>
      <BackgroundVideo />
      <div className="flex-1 relative overflow-hidden z-0">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary-800/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-32">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/40 border border-primary-800 text-primary-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
            AI-Powered Compatibility Matching
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-white leading-tight mb-6">
            Find Your{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-300">
              Perfect Room
            </span>
            <br />
            & Ideal Flatmate
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Stop guessing. Our AI scores every listing against your preferences — location, budget, 
            and move-in date — so you see the best matches first.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            {user ? (
              <Link
                to={user.role === 'tenant' ? '/listings' : '/dashboard/owner'}
                className="btn-primary px-8 py-3 text-base"
              >
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn-primary px-8 py-3 text-base">
                  Get Started Free
                </Link>
                <Link to="/login" className="btn-secondary px-8 py-3 text-base">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '🤖',
              title: 'AI Compatibility Scores',
              desc: 'Google Gemini analyses every listing against your profile and returns a 0–100 match score with an explanation.',
            },
            {
              icon: '💬',
              title: 'Real-Time Chat',
              desc: 'Once an owner accepts your interest, both parties get an instant, persistent chat session via WebSocket.',
            },
            {
              icon: '🔔',
              title: 'Smart Notifications',
              desc: 'Owners are alerted when a high-score tenant (>80) expresses interest. Tenants know immediately when accepted.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-transparent border border-white/10 rounded-2xl p-6 shadow-xl hover:bg-white/5 transition-all duration-300">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-gray-100 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </>
  );
}
