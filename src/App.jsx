import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import ActivityPage from './pages/Activity';
import ReportsPage from './pages/Reports';
import MyWorkPage from './pages/MyWork';
import BudgetTrackerPage from './pages/BudgetTracker';
import ApprovalsPage from './pages/Approvals';
import ProcurementPage from './pages/Procurement';
import TeamConnectPage from './pages/TeamConnect';
import GanttSchedulerPage from './pages/GanttScheduler';
import ComplianceAuditPage from './pages/ComplianceAudit';
import ResourcePlanningPage from './pages/ResourcePlanning';
import DocumentHubPage from './pages/DocumentHub';
import BillingModulePage from './pages/BillingModule';
import NotificationCenterPage from './pages/NotificationCenter';
import PerformanceRewardsPage from './pages/PerformanceRewards';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import SignInPage from '@/components/SignInPage';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => {
  useEffect(() => {
    const title = currentPageName.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    document.title = `${title} | Net Term Solutions`;
  }, [currentPageName]);

  return Layout ?
    <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <SignInPage onSignIn={navigateToLogin} />;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/Activity" element={<LayoutWrapper currentPageName="Activity"><ActivityPage /></LayoutWrapper>} />
      <Route path="/Reports" element={<LayoutWrapper currentPageName="Reports"><ReportsPage /></LayoutWrapper>} />
      <Route path="/MyWork" element={<LayoutWrapper currentPageName="My Work"><MyWorkPage /></LayoutWrapper>} />
      <Route path="/BudgetTracker" element={<LayoutWrapper currentPageName="Budget Tracker"><BudgetTrackerPage /></LayoutWrapper>} />
      <Route path="/TeamConnect" element={<LayoutWrapper currentPageName="Team Connect"><TeamConnectPage /></LayoutWrapper>} />
      <Route path="/GanttScheduler" element={<LayoutWrapper currentPageName="Gantt / Scheduler"><GanttSchedulerPage /></LayoutWrapper>} />
      <Route path="/Approvals" element={<LayoutWrapper currentPageName="Approvals"><ApprovalsPage /></LayoutWrapper>} />
      <Route path="/Procurement" element={<LayoutWrapper currentPageName="Inventory & Assets"><ProcurementPage /></LayoutWrapper>} />
      <Route path="/ComplianceAudit" element={<LayoutWrapper currentPageName="Compliance & Audit"><ComplianceAuditPage /></LayoutWrapper>} />
      <Route path="/ResourcePlanning" element={<LayoutWrapper currentPageName="Resource Planning"><ResourcePlanningPage /></LayoutWrapper>} />
      <Route path="/DocumentHub" element={<LayoutWrapper currentPageName="Document Hub"><DocumentHubPage /></LayoutWrapper>} />
      <Route path="/BillingModule" element={<LayoutWrapper currentPageName="Billing & Invoicing"><BillingModulePage /></LayoutWrapper>} />
      <Route path="/NotificationCenter" element={<LayoutWrapper currentPageName="Notification Center"><NotificationCenterPage /></LayoutWrapper>} />
      <Route path="/PerformanceRewards" element={<LayoutWrapper currentPageName="Performance & Rewards"><PerformanceRewardsPage /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App