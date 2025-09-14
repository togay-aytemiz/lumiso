import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BaseOnboardingModal, OnboardingAction } from "./BaseOnboardingModal";
import { TutorialFloatingCard } from "./TutorialFloatingCard";
import { TutorialExitGuardDialog } from "./TutorialExitGuardDialog";
import { useTutorialExit } from "@/hooks/useTutorialExit";

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
}

export function OnboardingTutorial({ 
  steps, 
  onComplete, 
  onExit, 
  isVisible,
  initialStepIndex = 0
}: OnboardingTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const navigate = useNavigate();
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const {
    showExitGuard,
    handleExitRequest,
    handleStay,
    handleReturnToGettingStarted,
    handleSkipSetup
  } = useTutorialExit({
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
    handleExitRequest();
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
          stepNumber={currentStepIndex + 1}
          totalSteps={steps.length}
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
        
        <TutorialExitGuardDialog
          open={showExitGuard}
          currentStepTitle={typeof currentStep.title === 'string' ? currentStep.title : 'Current Step'}
          onStay={handleStay}
          onReturnToGettingStarted={handleReturnToGettingStarted}
          onSkipSetup={handleSkipSetup}
        />
      </>
    );
  }

  // Modal tutorial rendering
  const actions: OnboardingAction[] = [];
  
  // Only show Exit Tutorial button if not the last step
  if (!isLastStep) {
    actions.push({
      label: "Exit Tutorial",
      onClick: handleExit,
      variant: "outline"
    });
  }
  
  actions.push({
    label: isLastStep ? "Continue Setup" : "Next",
    onClick: handleNext,
    variant: "default",
    disabled: !currentStep.canProceed
  });

  return (
    <>
      <BaseOnboardingModal
        open={isVisible}
        onClose={handleExit}
        title={`Step ${currentStepIndex + 1} of ${steps.length}: ${typeof currentStep.title === 'string' ? currentStep.title : 'Step'}`}
        description={currentStep.description}
        actions={actions}
      >
        {currentStep.content && (
          <div className="text-sm leading-relaxed">
            {currentStep.content}
          </div>
        )}
      </BaseOnboardingModal>
      
      <TutorialExitGuardDialog
        open={showExitGuard}
        currentStepTitle={typeof currentStep.title === 'string' ? currentStep.title : 'Current Step'}
        onStay={handleStay}
        onReturnToGettingStarted={handleReturnToGettingStarted}
        onSkipSetup={handleSkipSetup}
      />
    </>
  );
}