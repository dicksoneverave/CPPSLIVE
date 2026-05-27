import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/Layout/MainLayout';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import DashboardRouter from './pages/dashboard/DashboardRouter';
import ReportsDashboard from './pages/dashboard/ReportsDashboard';

const ProtectedRoute: React.FC<{ element: React.ReactNode }> = ({ element }) => {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <>{element}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<MainLayout />}>
            <Route index element={<LandingPage />} />
            <Route
              path="/dashboard/*"
              element={<ProtectedRoute element={<DashboardRouter />} />}
            />
            {/* NEW: Reports hub (protected) */}
            <Route
              path="/reports"
              element={<ProtectedRoute element={<ReportsDashboard />} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
