import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useI18nToast } from "@/lib/toastHelpers";
import { toast as toastFn } from "@/hooks/use-toast";
import { BaseOnboardingModal, type OnboardingAction } from "./shared/BaseOnboardingModal";
import { SampleDataModal } from "./SampleDataModal";
import { useTranslation } from "react-i18next";
import { Package, Settings2, Users } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";

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
  const { profile } = useProfile();
  const { settings } = useOrganizationSettings();

  const onboardingFirstName = useMemo(() => {
    const metadataFullName =
      typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined;
    const fullName =
      profile?.full_name ||
      metadataFullName ||
      (user?.email ? user.email.split("@")[0] : undefined);

    if (!fullName) return null;
    const first = fullName.trim().split(/\s+/)[0];
    return first || null;
  }, [profile?.full_name, user?.email, user?.user_metadata?.full_name]);

  const onboardingBusinessName = useMemo(() => {
    const name = settings?.photography_business_name?.trim();
    return name || null;
  }, [settings?.photography_business_name]);

  const welcomeTitle = onboardingFirstName
    ? t("onboarding.modal.welcome_title", { firstName: onboardingFirstName })
    : t("onboarding.modal.welcome_title_generic", {
        defaultValue: t("onboarding.modal.welcome_title", { defaultValue: "Lumiso'ya Hoş Geldiniz 🎉" })
      });

  const welcomeSubtitle = onboardingBusinessName
    ? t("onboarding.modal.welcome_subtitle", { businessName: onboardingBusinessName })
    : t("onboarding.modal.welcome_subtitle_generic", {
        defaultValue: t("onboarding.modal.welcome_subtitle", { defaultValue: "Lumiso'yu öğrenmene yardım edeceğiz" })
      });

  const handleStartLearning = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await startGuidedSetup(); // This sets welcome_modal_shown = true PERMANENTLY
      
      onClose(); // Close modal
      navigate('/getting-started');
      toastFn({
        title: welcomeTitle,
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
        title={welcomeTitle}
        description={welcomeSubtitle}
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
