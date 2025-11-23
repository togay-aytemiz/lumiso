import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useI18nToast } from "@/lib/toastHelpers";
import { toast as toastFn } from "@/hooks/use-toast";
import { BaseOnboardingModal, type OnboardingAction } from "./shared/BaseOnboardingModal";
import { SampleDataModal } from "./SampleDataModal";
import { useTranslation } from "react-i18next";
import { Package, Settings2, Users } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

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

  const onboardingBullets = [
    { Icon: Settings2, title: t('onboarding.modal.bullets.profile_and_settings') },
    { Icon: Users, title: t('onboarding.modal.bullets.contacts_projects_sessions') },
    { Icon: Package, title: t('onboarding.modal.bullets.packages_and_services') },
  ];

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
        <ul className="space-y-2">
          {onboardingBullets.map(({ Icon, title }, index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-2"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground">{title}</span>
            </li>
          ))}
        </ul>
      </BaseOnboardingModal>

      <SampleDataModal
        open={showSampleDataModal}
        onClose={handleCloseSampleDataModal}
        onCloseAll={handleCloseAll}
      />
    </>
  );
}
