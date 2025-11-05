import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { useLayoutEffect, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";
import OfflineBanner from "@/components/OfflineBanner";
import RoutePrefetcher from "@/components/RoutePrefetcher";
import { useIsMobile } from "@/hooks/use-mobile";

const LAST_NON_SETTINGS_PATH_KEY = "lumiso:last-non-settings-path";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { shouldShowWelcomeModal, loading: onboardingLoading, shouldLockNavigation } = useOnboarding();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!location.pathname.startsWith("/settings")) {
      const nextValue = `${location.pathname}${location.search}${location.hash}`;
      window.sessionStorage.setItem(LAST_NON_SETTINGS_PATH_KEY, nextValue || "/");
    }
  }, [location.pathname, location.search, location.hash]);

  // Simple rule: Don't show modal on getting-started page
  const isOnGettingStartedPage = location.pathname === '/getting-started';

  // Enhanced modal display logic with better state management
  useEffect(() => {
    // Only show modal if onboarding hook explicitly says to show it
    // The hook now handles session tracking internally
    const shouldShow = !onboardingLoading && 
                      !isOnGettingStartedPage && 
                      shouldShowWelcomeModal; // This now includes session tracking

    setShowOnboardingModal(shouldShow);
  }, [onboardingLoading, shouldShowWelcomeModal, isOnGettingStartedPage]);

  useLayoutEffect(() => {
    // Disable automatic scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    // Force scroll to top immediately and after next frame
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    
    scrollToTop();
    requestAnimationFrame(scrollToTop);
  }, [location.pathname]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {!isMobile && <AppSidebar />}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          {!isMobile && (
            <div className="flex items-center justify-start p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
              <SidebarTrigger />
            </div>
          )}
          {/* Global connectivity banner */}
          <OfflineBanner />
          {/* Route-aware prefetch for list first pages */}
          <RoutePrefetcher />
          
          <div className="flex-1 pb-24 md:pb-0 min-w-0">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav hideForOnboarding={showOnboardingModal || shouldLockNavigation} />
      
      {/* Onboarding Modal with enhanced close handling */}
      <OnboardingModal 
        open={showOnboardingModal} 
        onClose={() => {
          setShowOnboardingModal(false);
        }} 
      />
      
      {/* Restart Guided Mode Button (only for specific user) */}
      <RestartGuidedModeButton />
    </SidebarProvider>
  );
}
