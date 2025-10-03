import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { ONBOARDING_STEPS } from "@/constants/onboarding";
import { useI18nToast } from "@/lib/toastHelpers";
import { toast as toastFn } from "@/hooks/use-toast";
import { BaseOnboardingModal, type OnboardingAction } from "./shared/BaseOnboardingModal";
import { SampleDataModal } from "./SampleDataModal";
import { useTranslation } from "react-i18next";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

// Use the centralized steps from the hook
const onboardingStepsDisplay = ONBOARDING_STEPS.map(step => step.title);

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { t } = useTranslation('pages');
  const toast = useI18nToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startGuidedSetup } = useOnboarding();

  const handleStartLearning = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await startGuidedSetup(); // This sets welcome_modal_shown = true PERMANENTLY
      
      onClose(); // Close modal
      navigate('/getting-started');
      toastFn({
        title: t('onboarding.modal.welcome_title'),
        description: t('onboarding.modal.toast.setup_started'),
      });
    } catch (error) {
      console.error('❌ OnboardingModal: Error:', error);
      toast.error(t('onboarding.modal.toast.setup_failed'));
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
    onClose(); // Simple close, no special handling needed
  };

  const actions: OnboardingAction[] = [
    {
      label: t('onboarding.modal.skip_sample_data'),
      onClick: handleShowSampleDataModal,
      variant: "outline",
      disabled: isLoading
    },
    {
      label: isLoading ? t('onboarding.modal.starting') : t('onboarding.modal.start_learning'),
      onClick: handleStartLearning,
      variant: "cta",
      disabled: isLoading
    }
  ];

  return (
    <>
      <BaseOnboardingModal
        open={open && !showSampleDataModal}
        onClose={onClose} // Simple close handler
        title={t('onboarding.modal.welcome_title')}
        description={t('onboarding.modal.welcome_subtitle')}
        actions={actions}
      >
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            {t('onboarding.modal.what_youll_learn')}
          </h4>
          <div className="space-y-3">
            {onboardingStepsDisplay.map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{index + 1}</span>
                </div>
                <span className="text-sm text-foreground">{t(`onboarding.steps.step_${index + 1}.title`)}</span>
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