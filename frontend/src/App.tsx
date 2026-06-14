import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { AlertsPage } from './pages/AlertsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { BackupPage } from './pages/BackupPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { LogsPage } from './pages/LogsPage';
import { MetricsPage } from './pages/MetricsPage';
import { NoalbsPage } from './pages/NoalbsPage';
import { ObsPage } from './pages/ObsPage';
import { ProfilePage } from './pages/ProfilePage';
import { TwitchPage } from './pages/TwitchPage';
import { RolesPage } from './pages/RolesPage';
import { SecurityPage } from './pages/SecurityPage';
import { SettingsPage } from './pages/SettingsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { UsersPage } from './pages/UsersPage';
import { useThemeStore } from './store/useThemeStore';

export default function App() {
  const resolve = useThemeStore((s) => s.resolve);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="monitoring" element={<MetricsPage />} />
            <Route path="health" element={<SystemHealthPage />} />
            <Route path="obs" element={<ObsPage />} />
            <Route path="twitch" element={<TwitchPage />} />
            <Route path="noalbs" element={<NoalbsPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="audit" element={<ProtectedRoute permission="audit.view"><AuditLogsPage /></ProtectedRoute>} />
            <Route path="backup" element={<ProtectedRoute permission="backup.view"><BackupPage /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute permission="users.view"><UsersPage /></ProtectedRoute>} />
            <Route path="roles" element={<ProtectedRoute permission="roles.view"><RolesPage /></ProtectedRoute>} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* Legacy redirects */}
            <Route path="metrics" element={<Navigate to="/monitoring" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
