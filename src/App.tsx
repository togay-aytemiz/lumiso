import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { PermissionDebugPanel } from "@/components/PermissionDebugPanel";
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
import TeamSettings from "./pages/settings/Team";
import NotificationsSettings from "./pages/settings/Notifications";
import ProjectsSettings from "./pages/settings/Projects";
import LeadsSettings from "./pages/settings/Leads";
import ServicesSettings from "./pages/settings/Services";
import IntegrationsSettings from "./pages/settings/Integrations";
import ClientMessagingSettings from "./pages/settings/ClientMessaging";
import ContractsSettings from "./pages/settings/Contracts";
import BillingSettings from "./pages/settings/Billing";
import DangerZoneSettings from "./pages/settings/DangerZone";
import NotFound from "./pages/NotFound";
import AcceptInvite from "./pages/AcceptInvite";
import AcceptInvitation from "./pages/AcceptInvitation";
import InvitationSignup from "./pages/InvitationSignup";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Workflows from "./pages/Workflows";
import Templates from "./pages/Templates";
import TemplateBuilder from "./pages/TemplateBuilder";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
          <ProfileProvider>
            <SettingsProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <PermissionDebugPanel />
                <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/accept-invitation" element={<InvitationSignup />} />
            <Route path="/invitation-signup" element={<InvitationSignup />} />
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
              <Route path="settings" element={<SettingsLayout />}>
                <Route path="profile" element={<ProfileSettings />} />
                <Route path="general" element={<GeneralSettings />} />
                <Route path="team" element={<TeamSettings />} />
                <Route path="notifications" element={<NotificationsSettings />} />
                <Route path="projects" element={<ProjectsSettings />} />
                <Route path="leads" element={<LeadsSettings />} />
                <Route path="services" element={<ServicesSettings />} />
                <Route path="integrations" element={<IntegrationsSettings />} />
                <Route path="client-messaging" element={<ClientMessagingSettings />} />
                <Route path="contracts" element={<ContractsSettings />} />
                <Route path="billing" element={<BillingSettings />} />
                <Route path="danger-zone" element={<DangerZoneSettings />} />
                <Route index element={<Navigate to="/settings/profile" replace />} />
              </Route>
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
          </SettingsProvider>
        </ProfileProvider>
      </OrganizationProvider>
    </AuthProvider>
  </QueryClientProvider>
</ErrorBoundary>
);

export default App;
