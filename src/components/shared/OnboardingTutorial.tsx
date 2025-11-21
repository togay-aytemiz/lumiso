import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BaseOnboardingModal, OnboardingAction } from "./BaseOnboardingModal";
import { TutorialFloatingCard } from "./TutorialFloatingCard";
import { useTutorialExit } from "@/hooks/useTutorialExit";
import { useTranslation } from "react-i18next";

export interface TutorialStep {
  id: number;
  title: string | React.ReactNode;
  description: string;
  content: React.ReactNode;
  canProceed: boolean;
  route?: string;
  mode?: 'modal' | 'floating';
  requiresAction?: boolean;
  disabledTooltip?: string;
}

interface OnboardingTutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onExit: () => void;
  isVisible: boolean;
  initialStepIndex?: number;
  displayOffset?: number;
  displayTotal?: number;
}

export function OnboardingTutorial({ 
  steps, 
  onComplete, 
  onExit, 
  isVisible,
  initialStepIndex = 0,
  displayOffset = 0,
  displayTotal
}: OnboardingTutorialProps) {
  const { t } = useTranslation('pages');
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const navigate = useNavigate();
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const effectiveTotal = displayTotal ?? displayOffset + steps.length;
  const displayStepNumber = displayOffset + currentStepIndex + 1;

  const { isExiting, handleExitNow } = useTutorialExit({
    currentStepTitle: typeof currentStep?.title === 'string' ? currentStep.title : 'Current Step',
    onExitComplete: onExit
  });

  // Update step index when initialStepIndex changes
  useEffect(() => {
    setCurrentStepIndex(initialStepIndex);
  }, [initialStepIndex]);

  // Navigate to step route if specified
  useEffect(() => {
    if (currentStep?.route && currentStepIndex > 0) {
      const params = new URLSearchParams();
      params.set('tutorial', 'true');
      params.set('step', (currentStepIndex + 1).toString());
      navigate(`${currentStep.route}?${params.toString()}`);
    }
  }, [currentStep?.route, currentStepIndex, navigate]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleExit = () => {
    handleExitNow();
  };

  if (!isVisible || !currentStep) {
    return null;
  }

  // Determine floating card position based on step characteristics
  const getFloatingPosition = () => {
    const isAddLeadStep = currentStep.id === 2 && currentStep.title === "Add Your First Lead";
    const isSchedulingTutorialStep = [3, 4].includes(currentStep.id);
    const isPackagesSetupStep = [1, 2, 3].includes(currentStep.id);
    const isProjectManagementStep = [2, 3, 4].includes(currentStep.id);

    if (isAddLeadStep || isPackagesSetupStep || isProjectManagementStep) {
      return "bottom-right";
    }
    if (isSchedulingTutorialStep) {
      return "top-right";
    }
    return "bottom-right";
  };

  // Floating tutorial rendering
  if (currentStep.mode === "floating") {
    return (
      <>
        <TutorialFloatingCard
          stepNumber={displayStepNumber}
          totalSteps={effectiveTotal}
          title={typeof currentStep.title === 'string' ? currentStep.title : 'Step'}
          description={currentStep.description}
          content={currentStep.content}
          canProceed={currentStep.canProceed}
          requiresAction={currentStep.requiresAction}
          disabledTooltip={currentStep.disabledTooltip}
          onNext={handleNext}
          onExit={handleExit}
          position={getFloatingPosition()}
        />
      </>
    );
  }

  // Modal tutorial rendering
  const actions: OnboardingAction[] = [];

  const stepLabel = t('onboarding.tutorial.step_of', { current: displayStepNumber, total: effectiveTotal });

  const eyebrowContent = (
    <div className="flex items-center gap-2 uppercase">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">{stepLabel}</span>
    </div>
  );
  
  // Only show Exit Tutorial button if not the last step
  if (!isLastStep) {
    actions.push({
      label: t('onboarding.tutorial.exit_tutorial'),
      onClick: handleExitNow,
      variant: "dangerOutline",
      longPress: { 
        duration: 3000, 
        holdingLabel: t('onboarding.tutorial.hold_to_exit'), 
        completeLabel: t('onboarding.tutorial.exiting')
      }
    });
  }
  
  actions.push({
    label: isLastStep ? t('onboarding.tutorial.continue_setup') : t('onboarding.tutorial.next'),
    onClick: handleNext,
    variant: "default",
    disabled: !currentStep.canProceed
  });

  return (
    <>
      <BaseOnboardingModal
        open={isVisible && !isExiting}
        onClose={handleExit}
        eyebrow={eyebrowContent}
        title={typeof currentStep.title === 'string' ? currentStep.title : stepLabel}
        description={currentStep.description}
        actions={actions}
      >
        {currentStep.content && (
          <div className="text-sm leading-relaxed">
            {currentStep.content}
          </div>
        )}
      </BaseOnboardingModal>
    </>
  );
}
