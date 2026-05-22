import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import NewMigration from './pages/NewMigration';
import ProjectDetail from './pages/ProjectDetail';
import Compatibility from './pages/Compatibility';
import Databases from './pages/Databases';
import BackupJobs from './pages/BackupJobs';
import RestoreJobs from './pages/RestoreJobs';
import StorageEngines from './pages/StorageEngines';
import Connections from './pages/Connections';
import AuditTrail from './pages/AuditTrail';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import ActivityLog from './pages/ActivityLog';

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  if (isLoadingAuth) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/"             element={<Dashboard />} />
        <Route path="/activity"     element={<ActivityLog />} />
        <Route path="/projects"     element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/new-migration" element={<NewMigration />} />
        <Route path="/compatibility" element={<Compatibility />} />
        <Route path="/databases"    element={<Databases />} />
        <Route path="/backups"      element={<BackupJobs />} />
        <Route path="/restore"      element={<RestoreJobs />} />
        <Route path="/storage"      element={<StorageEngines />} />
        <Route path="/connections"  element={<Connections />} />
        <Route path="/audit"        element={<AuditTrail />} />
        <Route path="/alerts"       element={<Alerts />} />
        <Route path="/settings"     element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*"     element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
