import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { PermissionDebugPanel } from "@/components/PermissionDebugPanel";
import { useLayoutEffect, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { shouldShowWelcomeModal, loading: onboardingLoading, shouldLockNavigation } = useOnboardingV2();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Simple rule: Don't show modal on getting-started page
  const isOnGettingStartedPage = location.pathname === '/getting-started';

  // V3: Enhanced modal display logic with better state management
  useEffect(() => {
    console.log('🖥️ V3 Layout: Modal check triggered', {
      onboardingLoading,
      shouldShowWelcomeModal,
      shouldLockNavigation,
      isOnGettingStartedPage,
      pathname: location.pathname
    });

    // V3: Only show modal if onboarding hook explicitly says to show it
    // The hook now handles session tracking internally
    const shouldShow = !onboardingLoading && 
                      !isOnGettingStartedPage && 
                      shouldShowWelcomeModal; // This now includes session tracking

    console.log('🖥️ V3 Layout: Setting modal to', shouldShow);
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
          <div className="flex-1 pb-24 md:pb-0 min-w-0">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav hideForOnboarding={showOnboardingModal || shouldLockNavigation} />
      
      {/* V3: Onboarding Modal with enhanced close handling */}
      <OnboardingModal 
        open={showOnboardingModal} 
        onClose={() => {
          console.log('🎯 V3 Layout: Onboarding modal closed from Layout');
          setShowOnboardingModal(false);
        }} 
      />
      
      {/* Restart Guided Mode Button (only for specific user) */}
      <RestartGuidedModeButton />
      
      {/* Permission Debug Panel (dev only) */}
      <PermissionDebugPanel />
    </SidebarProvider>
  );
}