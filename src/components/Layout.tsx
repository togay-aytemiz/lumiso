import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { OnboardingModal } from "@/components/OnboardingModal";
import { ContextualGuidance } from "@/components/ContextualGuidance";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { useLayoutEffect, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { shouldShowOnboarding, loading: onboardingLoading, inGuidedSetup } = useOnboarding();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Simple rule: Don't show modal on getting-started page
  const isOnGettingStartedPage = location.pathname === '/getting-started';

  // Check if we should show onboarding modal
  useEffect(() => {
    if (!onboardingLoading && !isOnGettingStartedPage) {
      if (shouldShowOnboarding) {
        setShowOnboardingModal(true);
      } else {
        setShowOnboardingModal(false);
      }
    } else {
      // Always hide modal on getting-started page
      setShowOnboardingModal(false);
    }
  }, [onboardingLoading, shouldShowOnboarding, isOnGettingStartedPage]);

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
      <MobileBottomNav hideForOnboarding={showOnboardingModal || inGuidedSetup} />
      
      {/* Onboarding Modal */}
      <OnboardingModal 
        open={showOnboardingModal} 
        onClose={() => setShowOnboardingModal(false)} 
      />
      
      {/* Contextual Guidance */}
      <ContextualGuidance />
      
      {/* Restart Guided Mode Button (only for specific user) */}
      <RestartGuidedModeButton />
    </SidebarProvider>
  );
}