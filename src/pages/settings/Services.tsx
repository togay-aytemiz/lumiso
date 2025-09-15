import { useState, useEffect } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { settingsHelpContent } from "@/lib/settingsHelpContent";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";
// Permissions removed for single photographer mode
import { useOnboarding } from "@/contexts/OnboardingContext";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { Package, DollarSign, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

const packagesSetupSteps: TutorialStep[] = [
  {
    id: 1,
    title: "Review Your Package Templates",
    description: "We've created some default photography packages for you. You can modify, delete, or keep them as they are. Click on any package to edit its details.",
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="w-4 h-4" />
          <span>Review and customize the default packages</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Tip: You can edit package names, descriptions, and what's included
        </div>
      </div>
    ),
    canProceed: true,
    mode: 'floating'
  },
  {
    id: 2,
    title: "Set Your Package Pricing",
    description: "Add or update pricing for your packages to streamline your client proposals and booking process.",
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
  },
  {
    id: 3,
    title: "Configure Your Services",
    description: "Review and customize the individual services that make up your packages. These are the building blocks you'll use when creating packages.",
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="w-4 h-4" />
          <span>Customize your service offerings</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Services can be reused across multiple packages
        </div>
      </div>
    ),
    canProceed: true,
    mode: 'floating'
  },
  {
    id: 4,
    title: "🎉 Packages Setup Complete!",
    description: "Excellent! You've successfully configured your photography packages and services. Your business is now ready to create professional proposals and manage bookings.",
    content: null, // Remove the content section
    canProceed: true,
    mode: 'modal'
  }
];

export default function Services() {
  // Permissions removed for single photographer mode - always allow
  // const { hasPermission, loading } = usePermissions();
  const { currentStep, completeCurrentStep } = useOnboarding();
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const navigate = useNavigate();

  // Auto-start packages tutorial when we're on step 6 (currentStep = 6)
  useEffect(() => {
    if (currentStep === 6 && !showTutorial) {
      console.log('🎯 Auto-starting packages tutorial for step 6');
      setShowTutorial(true);
      setCurrentTutorialStep(0);
    }
  }, [currentStep, showTutorial]);

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    try {
      console.log('🎉 Packages tutorial completed - completing step 6');
      setShowTutorial(false);
      
      // Complete step 6 and mark guidance as complete
      await completeCurrentStep();
      
      console.log('✅ Step 6 completed, navigating to getting-started');
      
      // Small delay to ensure database update, then navigate
      setTimeout(() => {
        navigate('/getting-started');
      }, 500);
      
    } catch (error) {
      console.error('❌ Error completing packages tutorial:', error);
    }
  };

  const handleTutorialExit = () => {
    setShowTutorial(false);
  };
  
  // Permissions removed for single photographer mode - always allow
  // if (loading) {
  //   return (
  //     <SettingsPageWrapper>
  //       <SettingsLoadingSkeleton rows={3} />
  //     </SettingsPageWrapper>
  //   );
  // }
  
  // Always show all sections in single photographer mode
  // Show page if user has permission to view packages or services
  // const canViewServices = hasPermission('view_services');
  // const canViewPackages = hasPermission('view_packages');
  
  // const hasAnyPermission = canViewServices || canViewPackages;
  
  // if (!hasAnyPermission) {
  //   return (
  //     <SettingsPageWrapper>
  //       <div className="text-center py-8">
  //         <p className="text-muted-foreground">You don't have permission to view this section.</p>
  //       </div>
  //     </SettingsPageWrapper>
  //   );
  // }
  
  return (
    <>
      <SettingsPageWrapper>
        <SettingsHeader
          title="Packages & Services"
          description="Create service packages and manage individual services for your business"
          helpContent={settingsHelpContent.services}
        />
        
        <div className="space-y-8">
          {/* Always show all sections in single photographer mode */}
          <PackagesSection />
          <ServicesSection />
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