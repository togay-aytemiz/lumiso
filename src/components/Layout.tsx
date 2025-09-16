import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLayoutEffect, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { shouldShowWelcomeModal, loading: onboardingLoading, shouldLockNavigation } = useOnboarding();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

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
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header with language switcher */}
          <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
            <SidebarTrigger />
            <LanguageSwitcher variant="compact" />
          </div>
          
          {/* Desktop header with language switcher */}
          <div className="hidden md:flex items-center justify-end p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <LanguageSwitcher variant="compact" />
          </div>
          
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