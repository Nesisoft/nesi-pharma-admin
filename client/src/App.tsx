import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Layouts
import DashboardLayout from '@/layouts/DashboardLayout';

// Pages
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import LicensesPage from '@/pages/LicensesPage';
import LicenseDetailPage from '@/pages/LicenseDetailPage';
import GenerateLicensePage from '@/pages/GenerateLicensePage';
import PharmaciesPage from '@/pages/PharmaciesPage';
import PharmacyDetailPage from '@/pages/PharmacyDetailPage';
import CreatePharmacyPage from '@/pages/CreatePharmacyPage';
import EditPharmacyPage from '@/pages/EditPharmacyPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import AuditLogsPage from '@/pages/AuditLogsPage';
import SettingsPage from '@/pages/SettingsPage';
import TierConfigsPage from '@/pages/TierConfigsPage';
import FeaturesPage from '@/pages/FeaturesPage';

// Components
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="licenses" element={<LicensesPage />} />
        <Route path="licenses/generate" element={<GenerateLicensePage />} />
        <Route path="licenses/:id" element={<LicenseDetailPage />} />
        <Route path="pharmacies" element={<PharmaciesPage />} />
        <Route path="pharmacies/new" element={<CreatePharmacyPage />} />
        <Route path="pharmacies/:id" element={<PharmacyDetailPage />} />
        <Route path="pharmacies/:id/edit" element={<EditPharmacyPage />} />
        <Route path="admin-users" element={<AdminUsersPage />} />
        <Route path="tier-configs" element={<TierConfigsPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
