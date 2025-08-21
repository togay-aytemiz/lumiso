import { useState, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { Package, DollarSign, Target } from "lucide-react";

const packagesSetupSteps: TutorialStep[] = [
  {
    id: 1,
    title: "Create Your First Package",
    description: "Photography packages help you organize your services and pricing. Start by creating a package like 'Portrait Session' or 'Wedding Photography'.",
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="w-4 h-4" />
          <span>Click "+ Add Package" to get started</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Pro tip: Include what's included in each package (e.g., number of edited photos, hours of coverage)
        </div>
      </div>
    ),
    canProceed: true,
    mode: 'floating'
  },
  {
    id: 2,
    title: "Set Your Pricing",
    description: "Add pricing to your packages to streamline your client proposals and booking process.",
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <DollarSign className="w-4 h-4" />
          <span>Set competitive prices for your packages</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Remember: You can always adjust prices later for individual projects
        </div>
      </div>
    ),
    canProceed: true,
    mode: 'floating'
  }
];

export default function Services() {
  const { hasPermission, loading } = usePermissions();
  const { completedCount, completeStep } = useOnboarding();
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);

  // Auto-start packages tutorial when we're on step 6 (completedCount = 5)
  useEffect(() => {
    if (completedCount === 5 && !showTutorial) {
      console.log('🎯 Auto-starting packages tutorial for step 6');
      setShowTutorial(true);
      setCurrentTutorialStep(0);
    }
  }, [completedCount, showTutorial]);

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    try {
      console.log('🎉 Packages tutorial completed');
      setShowTutorial(false);
      await completeStep(); // Complete current step (step 6)
    } catch (error) {
      console.error('Error completing packages tutorial:', error);
    }
  };

  const handleTutorialExit = () => {
    setShowTutorial(false);
    console.log('❌ Packages tutorial exited');
  };
  
  if (loading) {
    return (
      <SettingsPageWrapper>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SettingsPageWrapper>
    );
  }
  
  // Show page if user has permission to view packages or services
  const canViewServices = hasPermission('view_services');
  const canViewPackages = hasPermission('view_packages');
  
  const hasAnyPermission = canViewServices || canViewPackages;
  
  if (!hasAnyPermission) {
    return (
      <SettingsPageWrapper>
        <div className="text-center py-8">
          <p className="text-muted-foreground">You don't have permission to view this section.</p>
        </div>
      </SettingsPageWrapper>
    );
  }
  
  return (
    <>
      <SettingsPageWrapper>
        <SettingsHeader
          title="Packages & Services"
          description="Create service packages and manage individual services for your business"
        />
        
        <div className="space-y-8">
          {canViewPackages && <PackagesSection />}
          {canViewServices && <ServicesSection />}
        </div>
      </SettingsPageWrapper>

      {/* Packages Setup Tutorial */}
      <OnboardingTutorial
        steps={packagesSetupSteps}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        isVisible={showTutorial}
        initialStepIndex={currentTutorialStep}
      />
    </>
  );
}