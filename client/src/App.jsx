import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ListingsPage from './pages/ListingsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import TenantDashboardPage from './pages/TenantDashboardPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <Navbar />
      <main className="flex-1 flex flex-col relative z-0">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Tenant routes */}
          <Route element={<ProtectedRoute roles={['tenant']} />}>
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/dashboard/tenant" element={<TenantDashboardPage />} />
          </Route>

          {/* Owner routes */}
          <Route element={<ProtectedRoute roles={['owner']} />}>
            <Route path="/dashboard/owner" element={<OwnerDashboardPage />} />
          </Route>

          {/* Chat — both tenant and owner */}
          <Route element={<ProtectedRoute roles={['tenant', 'owner']} />}>
            <Route path="/chat/:requestId" element={<ChatPage />} />
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <div className="text-5xl mb-4">404</div>
                <p>Page not found</p>
              </div>
            </div>
          } />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
