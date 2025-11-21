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
import { CalendarClock, FolderCheck, ListChecks, Settings2, Sparkles, Users } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

const onboardingStepIcons = [Users, ListChecks, Settings2, CalendarClock, FolderCheck, Sparkles];

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

  const onboardingHighlights = ONBOARDING_STEPS.slice(0, 3).map((step, index) => {
    const Icon = onboardingStepIcons[index % onboardingStepIcons.length];
    return {
      Icon,
      title: t(`onboarding.steps.step_${step.id}.title`),
      description: t(`onboarding.steps.step_${step.id}.description`),
      duration: t(`onboarding.steps.step_${step.id}.duration`)
    };
  });

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
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t('onboarding.modal.what_youll_learn')}
              </p>
              <p className="text-xs text-muted-foreground">{t('onboarding.getting_started.learning_path_subtitle')}</p>
            </div>
          </div>

          <div className="space-y-3">
            {onboardingHighlights.map(({ Icon, title, description, duration }, index) => (
              <div key={index} className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/80 p-3 sm:p-4 shadow-sm">
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl bg-emerald-50" />
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-emerald-600">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {title}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {duration}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
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
