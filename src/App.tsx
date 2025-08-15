import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AllLeads from "./pages/AllLeads";
import AllProjects from "./pages/AllProjects";
import LeadDetail from "./pages/LeadDetail";
import UpcomingSessions from "./pages/UpcomingSessions";
import Calendar from "./pages/Calendar";
import ReminderDetails from "./pages/ReminderDetails";
import Analytics from "./pages/Analytics";
import Payments from "./pages/Payments";
import SettingsLayout from "./components/settings/SettingsLayout";
import GeneralSettings from "./pages/settings/General";
import AccountSettings from "./pages/settings/Account";
import NotificationsSettings from "./pages/settings/Notifications";
import ProjectsSettings from "./pages/settings/Projects";
import LeadsSettings from "./pages/settings/Leads";
import ServicesSettings from "./pages/settings/Services";
import IntegrationsSettings from "./pages/settings/Integrations";
import ClientMessagingSettings from "./pages/settings/ClientMessaging";
import ContractsSettings from "./pages/settings/Contracts";
import BillingSettings from "./pages/settings/Billing";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute />}>
              <Route index element={<Index />} />
              <Route path="leads" element={<AllLeads />} />
              <Route path="projects" element={<AllProjects />} />
              <Route path="leads/:id" element={<LeadDetail />} />
              <Route path="sessions" element={<UpcomingSessions />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="reminders" element={<ReminderDetails />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="payments" element={<Payments />} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/general" replace />} />
                <Route path="general" element={<GeneralSettings />} />
                <Route path="account" element={<AccountSettings />} />
                <Route path="notifications" element={<NotificationsSettings />} />
                <Route path="projects" element={<ProjectsSettings />} />
                <Route path="leads" element={<LeadsSettings />} />
                <Route path="services" element={<ServicesSettings />} />
                <Route path="integrations" element={<IntegrationsSettings />} />
                <Route path="client-messaging" element={<ClientMessagingSettings />} />
                <Route path="contracts" element={<ContractsSettings />} />
                <Route path="billing" element={<BillingSettings />} />
              </Route>
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
