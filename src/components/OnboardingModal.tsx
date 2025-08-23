import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingV2, ONBOARDING_STEPS } from "@/hooks/useOnboardingV2";
import { toast } from "@/hooks/use-toast";
import { BaseOnboardingModal, type OnboardingAction } from "./shared/BaseOnboardingModal";
import { SampleDataModal } from "./SampleDataModal";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

// Use the centralized steps from the hook
const onboardingStepsDisplay = ONBOARDING_STEPS.map(step => step.title);

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startGuidedSetup, markModalShown } = useOnboardingV2();

  // V3: Mark modal as shown when it's closed without starting guided setup
  const handleClose = () => {
    console.log('🎯 V3 OnboardingModal: Closing modal and marking as shown');
    markModalShown();
    onClose();
  };

  const handleStartLearning = async () => {
    if (!user) return;
    
    console.log('🚀 V3 OnboardingModal: Starting guided setup from modal');
    setIsLoading(true);
    try {
      await startGuidedSetup();
      
      onClose(); // Close modal first
      navigate('/getting-started');
      toast({
        title: "Welcome to Lumiso! 🎉",
        description: "Let's get you set up step by step.",
      });
    } catch (error) {
      console.error('❌ V3 OnboardingModal: Error starting guided setup:', error);
      toast({
        title: "Error",
        description: "Failed to start guided setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowSampleDataModal = () => {
    setShowSampleDataModal(true);
  };

  const handleCloseSampleDataModal = () => {
    setShowSampleDataModal(false);
  };

  const handleCloseAll = () => {
    setShowSampleDataModal(false);
    handleClose(); // Use the enhanced close handler
  };

  const actions: OnboardingAction[] = [
    {
      label: "Skip & Use Sample Data",
      onClick: handleShowSampleDataModal,
      variant: "outline",
      disabled: isLoading
    },
    {
      label: isLoading ? "Starting..." : "Start Learning!",
      onClick: handleStartLearning,
      variant: "cta",
      disabled: isLoading
    }
  ];

  return (
    <>
      <BaseOnboardingModal
        open={open && !showSampleDataModal}
        onClose={handleClose} // Use enhanced close handler
        title="Welcome to Lumiso! 🎉"
        description="We'll guide you through setting up your photography CRM step by step. Each task builds on the previous one, so you'll learn naturally."
        actions={actions}
      >
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            What you'll learn:
          </h4>
          <div className="space-y-3">
            {onboardingStepsDisplay.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{index + 1}</span>
                </div>
                <span className="text-sm text-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </BaseOnboardingModal>

      <SampleDataModal
        open={showSampleDataModal}
        onClose={handleCloseSampleDataModal}
        onCloseAll={handleCloseAll}
      />
    </>
  );
}