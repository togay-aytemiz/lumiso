import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import SessionTypesSection from "@/components/SessionTypesSection";
import PackagesSection from "@/components/PackagesSection";
import ServicesSection from "@/components/ServicesSection";
// Permissions removed for single photographer mode
import { useOnboarding } from "@/contexts/useOnboarding";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { OnboardingVideo } from "@/components/shared/OnboardingVideo";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TFunction } from "i18next";

const PACKAGES_TUTORIAL_VIDEO_ID = import.meta.env.VITE_PACKAGES_TUTORIAL_VIDEO_ID || "oaK_S4FLSg8";
const PACKAGES_TUTORIAL_VIDEO_URL = `https://www.youtube.com/embed/${PACKAGES_TUTORIAL_VIDEO_ID}?rel=0&modestbranding=1&playsinline=1`;

const createPackagesSetupSteps = (t: TFunction<"pages">, videoUrl = PACKAGES_TUTORIAL_VIDEO_URL): TutorialStep[] => [
  {
    id: 0,
    title: t("settings.services.tutorial.steps.introVideo.title"),
    description: t("settings.services.tutorial.steps.introVideo.description"),
    content: (
      <div className="space-y-3">
        <OnboardingVideo
          src={videoUrl}
          title={t("settings.services.tutorial.steps.introVideo.videoTitle")}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    ),
    canProceed: true,
    mode: "modal",
    modalSize: "wide",
    primaryCtaLabel: t("settings.services.tutorial.steps.introVideo.cta"),
  },
  {
    id: 1,
    title: t("settings.services.tutorial.steps.configureServices.title"),
    description: t("settings.services.tutorial.steps.configureServices.description"),
    content: null,
    canProceed: true,
    mode: "floating",
  },
  {
    id: 2,
    title: t("settings.services.tutorial.steps.reviewTemplates.title"),
    description: t("settings.services.tutorial.steps.reviewTemplates.description"),
    content: null,
    canProceed: true,
    mode: "floating",
  },
  {
    id: 3,
    title: t("settings.services.tutorial.steps.sessionTypes.title"),
    description: t("settings.services.tutorial.steps.sessionTypes.description"),
    content: null,
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
  const sessionTypesRef = useRef<HTMLDivElement | null>(null);
  const packagesRef = useRef<HTMLDivElement | null>(null);
  const servicesRef = useRef<HTMLDivElement | null>(null);
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

  const scrollToSection = useCallback((target: React.RefObject<HTMLDivElement>) => {
    const element = target.current;
    if (!element || typeof element.scrollIntoView !== "function") return;
    element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, []);

  const handleTutorialStepChange = useCallback(
    (_index: number, step: TutorialStep) => {
      if (step.id === 1) {
        scrollToSection(servicesRef);
      } else if (step.id === 2) {
        scrollToSection(packagesRef);
      } else if (step.id === 3) {
        scrollToSection(sessionTypesRef);
      }
    },
    [scrollToSection]
  );
  
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
          <div ref={sessionTypesRef}>
            <SessionTypesSection />
          </div>
          <div ref={packagesRef}>
            <PackagesSection />
          </div>
          <div ref={servicesRef}>
            <ServicesSection />
          </div>
        </div>
      </SettingsPageWrapper>

      {/* Packages Setup Tutorial */}
      <OnboardingTutorial
        steps={packagesSetupSteps}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        isVisible={showTutorial}
        initialStepIndex={currentTutorialStep}
        onStepChange={handleTutorialStepChange}
      />
    </>
  );
}
