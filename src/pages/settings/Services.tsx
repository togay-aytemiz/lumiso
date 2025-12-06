import { useState, useEffect, useMemo } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import SessionTypesSection from "@/components/SessionTypesSection";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";
// Permissions removed for single photographer mode
import { useOnboarding } from "@/contexts/OnboardingContext";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { OnboardingChecklistItem } from "@/components/shared/OnboardingChecklistItem";
import { Package, DollarSign, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";

const createPackagesSetupSteps = (t: TFunction<"pages">): TutorialStep[] => [
  {
    id: 1,
    title: t("settings.services.tutorial.steps.reviewTemplates.title"),
    description: t("settings.services.tutorial.steps.reviewTemplates.description"),
    content: (
      <div className="space-y-3">
        <OnboardingChecklistItem
          icon={Package}
          title={t("settings.services.highlights.reviewPackages")}
          className="text-sm text-muted-foreground"
          titleClassName="text-sm font-medium text-muted-foreground"
        />
        <div className="text-xs text-muted-foreground">
          {t("settings.services.tutorial.steps.reviewTemplates.tip")}
        </div>
      </div>
    ),
    canProceed: true,
    mode: "floating",
  },
  {
    id: 2,
    title: t("settings.services.tutorial.steps.setPricing.title"),
    description: t("settings.services.tutorial.steps.setPricing.description"),
    content: (
      <div className="space-y-3">
        <OnboardingChecklistItem
          icon={DollarSign}
          title={t("settings.services.highlights.setPrices")}
          className="text-sm text-muted-foreground"
          titleClassName="text-sm font-medium text-muted-foreground"
        />
        <div className="text-xs text-muted-foreground">
          {t("settings.services.tutorial.steps.setPricing.tip")}
        </div>
      </div>
    ),
    canProceed: true,
    mode: "floating",
  },
  {
    id: 3,
    title: t("settings.services.tutorial.steps.configureServices.title"),
    description: t("settings.services.tutorial.steps.configureServices.description"),
    content: (
      <div className="space-y-3">
        <OnboardingChecklistItem
          icon={Target}
          title={t("settings.services.highlights.customizeOfferings")}
          className="text-sm text-muted-foreground"
          titleClassName="text-sm font-medium text-muted-foreground"
        />
        <div className="text-xs text-muted-foreground">
          {t("settings.services.tutorial.steps.configureServices.tip")}
        </div>
      </div>
    ),
    canProceed: true,
    mode: "floating",
  },
  {
    id: 4,
    title: t("settings.services.tutorial.steps.complete.title"),
    description: t("settings.services.tutorial.steps.complete.description"),
    content: null,
    canProceed: true,
    mode: "modal",
  },
];

export default function Services() {
  const { t } = useTranslation("pages");
  const packagesSetupSteps = useMemo(() => createPackagesSetupSteps(t), [t]);
  // Permissions removed for single photographer mode - always allow
  // const { hasPermission, loading } = usePermissions();
  const { currentStep, completeCurrentStep } = useOnboarding();
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const navigate = useNavigate();

  // Auto-start packages tutorial when we're on the packages step
  useEffect(() => {
    if (currentStep === 5 && !showTutorial) {
      // Auto-starting packages tutorial for final step
      setShowTutorial(true);
      setCurrentTutorialStep(0);
    }
  }, [currentStep, showTutorial]);

  // Handle tutorial completion
  const handleTutorialComplete = async () => {
    try {
      console.log('🎉 Packages tutorial completed - completing packages step');
      setShowTutorial(false);
      
      // Complete the packages step and mark guidance as complete
      await completeCurrentStep();
      
      // Final tutorial step completed
      
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
        <div className="space-y-8">
          {/* Always show all sections in single photographer mode */}
          <SessionTypesSection />
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
