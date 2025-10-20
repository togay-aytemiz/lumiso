import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from './App.tsx'
import './index.css'
import './i18n'; // Initialize i18n
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster as ShadToaster } from "@/components/ui/toaster";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";
import { PortalResetProvider } from "@/contexts/PortalResetContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
 
 const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <PortalResetProvider>
      <AuthProvider>
        <OrganizationProvider>
          <LanguageProvider>
            <ProfileProvider>
              <SettingsProvider>
                <OnboardingProvider>
                  <PerformanceMonitor />
                  <App />
                  <SonnerToaster />
                  <ShadToaster />
                </OnboardingProvider>
              </SettingsProvider>
            </ProfileProvider>
          </LanguageProvider>
        </OrganizationProvider>
      </AuthProvider>
    </PortalResetProvider>
  </QueryClientProvider>
);
