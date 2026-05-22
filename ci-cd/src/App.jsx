import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';

// Page imports
import Dashboard from '@/pages/Dashboard';
import ChangeRequests from '@/pages/ChangeRequests';
import NewChangeRequest from '@/pages/NewChangeRequest';
import ChangeDetail from '@/pages/ChangeDetail';
import LocalTest from '@/pages/LocalTest';
import DBAApprovals from '@/pages/DBAApprovals';
import DeployHistory from '@/pages/DeployHistory';
import Environments from '@/pages/Environments';
import WebhookSettings from '@/pages/WebhookSettings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/changes" element={<ChangeRequests />} />
        <Route path="/changes/new" element={<NewChangeRequest />} />
        <Route path="/changes/:id" element={<ChangeDetail />} />
        <Route path="/local-test" element={<LocalTest />} />
        <Route path="/approvals" element={<DBAApprovals />} />
        <Route path="/history" element={<DeployHistory />} />
        <Route path="/environments" element={<Environments />} />
        <Route path="/webhooks" element={<WebhookSettings />} />
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
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App