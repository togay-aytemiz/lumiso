import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "@/hooks/use-toast";
import { BaseOnboardingModal, type OnboardingAction } from "./shared/BaseOnboardingModal";
import { SampleDataModal } from "./SampleDataModal";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startGuidedSetup, steps } = useOnboarding();

  const handleStartLearning = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await startGuidedSetup();
      
      onClose();
      navigate('/getting-started');
      toast({
        title: "Welcome to Lumiso! 🎉",
        description: "Let's get you set up step by step.",
      });
    } catch (error) {
      console.error('Error starting guided setup:', error);
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
    onClose();
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
        onClose={onClose}
        title="Welcome to Lumiso! 🎉"
        description="We'll guide you through setting up your photography CRM step by step. Each task builds on the previous one, so you'll learn naturally."
        actions={actions}
      >
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            What you'll learn:
          </h4>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">{step.id}</span>
              </div>
              <span className="text-sm text-foreground">{step.title}</span>
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