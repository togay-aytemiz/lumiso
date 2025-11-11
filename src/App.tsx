import { TooltipProvider } from "@/components/ui/tooltip";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import type { Location } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import GettingStarted from "./pages/GettingStarted";
import AllLeads from "./pages/AllLeads";
import AllProjects from "./pages/AllProjects";
import LeadDetail from "./pages/LeadDetail";
import ProjectDetail from "./pages/ProjectDetail";
import UpcomingSessions from "./pages/UpcomingSessions";
import SessionDetail from "./pages/SessionDetail";
import Calendar from "./pages/Calendar";
import ReminderDetails from "./pages/ReminderDetails";
import Analytics from "./pages/Analytics";
import Payments from "./pages/Payments";
import SettingsLayout from "./components/settings/SettingsLayout";
import GeneralSettings from "./pages/settings/General";
import ProfileSettings from "./pages/settings/Profile";
import NotificationsSettings from "./pages/settings/Notifications";
import ProjectsSettings from "./pages/settings/Projects";
import LeadsSettings from "./pages/settings/Leads";
import ServicesSettings from "./pages/settings/Services";
import ContractsSettings from "./pages/settings/Contracts";
import BillingSettings from "./pages/settings/Billing";
import BillingSubscriptionSettings from "./pages/settings/BillingSubscription";
import DangerZoneSettings from "./pages/settings/DangerZone";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Workflows from "./pages/Workflows";
import Templates from "./pages/Templates";
import TemplateBuilder from "./pages/TemplateBuilder";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLocalization from "./pages/admin/Localization";
import AdminUsers from "./pages/admin/Users";
import AdminSystem from "./pages/admin/System";
import { FEATURE_FLAGS, isFeatureEnabled } from "./lib/featureFlags";

const renderSettingsRoutes = (enableOverlay: boolean) => (
  <Route path="settings" element={<SettingsLayout enableOverlay={enableOverlay} />}>
    <Route path="profile" element={<ProfileSettings />} />
    <Route path="general" element={<GeneralSettings />} />
    <Route path="notifications" element={<NotificationsSettings />} />
    <Route path="projects" element={<ProjectsSettings />} />
    <Route path="leads" element={<LeadsSettings />} />
    <Route path="services" element={<ServicesSettings />} />
    <Route path="contracts" element={<ContractsSettings />} />
    <Route path="billing" element={<BillingSettings />} />
    <Route path="billing/subscription" element={<BillingSubscriptionSettings />} />
    <Route path="danger-zone" element={<DangerZoneSettings />} />
  </Route>
);

const AppRoutes = () => {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | undefined;
  const settingsOverlayEnabled = isFeatureEnabled(
    FEATURE_FLAGS.settingsModalOverlayV1
  );

  return (
    <>
      <Routes location={state?.backgroundLocation ?? location}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/signin" element={<Auth />} />
        <Route path="/auth/sign-in" element={<Auth />} />
        <Route path="/auth/recovery" element={<Auth />} />
        <Route path="/auth/signup" element={<Auth />} />
        <Route path="/auth/sign-up" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute />}>
          <Route index element={<Index />} />
          <Route path="getting-started" element={<GettingStarted />} />
          <Route path="leads" element={<AllLeads />} />
          <Route path="projects" element={<AllProjects />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="sessions" element={<UpcomingSessions />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="reminders" element={<ReminderDetails />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="payments" element={<Payments />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="templates" element={<Templates />} />
          <Route path="template-builder" element={<TemplateBuilder />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route path="localization" element={<AdminLocalization />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="system" element={<AdminSystem />} />
            <Route index element={<Navigate to="/admin/localization" replace />} />
          </Route>
          {renderSettingsRoutes(settingsOverlayEnabled)}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>

      {state?.backgroundLocation && settingsOverlayEnabled && (
        <Routes>
          <Route path="/" element={<ProtectedRoute disableLayout />}>
            {renderSettingsRoutes(settingsOverlayEnabled)}
          </Route>
        </Routes>
      )}
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <TooltipProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </ErrorBoundary>
);

export default App;
