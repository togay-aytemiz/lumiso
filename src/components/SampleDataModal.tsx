import { useState } from "react";
import { CheckCircle, Users, FolderOpen, Calendar, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { BaseOnboardingModal, type OnboardingAction } from "./shared/BaseOnboardingModal";
import { useTranslation } from "react-i18next";

interface SampleDataModalProps {
  open: boolean;
  onClose: () => void;
  onCloseAll?: () => void;
}

export function SampleDataModal({ open, onClose, onCloseAll }: SampleDataModalProps) {
  const { t } = useTranslation('pages');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const { startGuidedSetup, skipOnboarding } = useOnboarding();

  const sampleDataItems = [
    {
      icon: Users,
      titleKey: "onboarding.sample_data.items.sample_leads.title",
      descriptionKey: "onboarding.sample_data.items.sample_leads.description"
    },
    {
      icon: FolderOpen, 
      titleKey: "onboarding.sample_data.items.example_projects.title",
      descriptionKey: "onboarding.sample_data.items.example_projects.description"
    },
    {
      icon: Calendar,
      titleKey: "onboarding.sample_data.items.scheduled_sessions.title",
      descriptionKey: "onboarding.sample_data.items.scheduled_sessions.description"
    },
    {
      icon: Package,
      titleKey: "onboarding.sample_data.items.photography_packages.title",
      descriptionKey: "onboarding.sample_data.items.photography_packages.description"
    }
  ];

  const handleSkipWithSampleData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await skipOnboarding();
      
      toast({
        title: t('onboarding.sample_data.toast.success_title'),
        description: t('onboarding.sample_data.toast.success_description'),
      });

      // Close all modals and redirect to leads page
      if (onCloseAll) {
        onCloseAll();
      } else {
        onClose();
      }
      navigate('/leads');
      
    } catch (error) {
      console.error('Error skipping setup:', error);
      toast({
        title: t('onboarding.sample_data.toast.error_title'),
        description: t('onboarding.sample_data.toast.error_description'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueGuidedSetup = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await startGuidedSetup();
      
      if (onCloseAll) {
        onCloseAll();
      } else {
        onClose();
      }
      navigate('/getting-started');
    } catch (error) {
      console.error('Error starting guided setup:', error);
      toast({
        title: t('onboarding.sample_data.toast.error_title'),
        description: t('onboarding.sample_data.toast.setup_error'),
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const actions: OnboardingAction[] = [
    {
      label: isLoading ? t('onboarding.sample_data.starting') : t('onboarding.sample_data.continue_guided_setup'),
      onClick: handleContinueGuidedSetup,
      variant: "outline",
      disabled: isLoading
    },
    {
      label: isLoading ? t('onboarding.sample_data.setting_up') : t('onboarding.sample_data.start_with_sample_data'),
      onClick: handleSkipWithSampleData,
      variant: "cta",
      disabled: isLoading
    }
  ];

  return (
    <BaseOnboardingModal
      open={open}
      onClose={onClose}
      title={t('onboarding.sample_data.title')}
      description={t('onboarding.sample_data.description')}
      actions={actions}
    >
      <div className="space-y-4">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          {t('onboarding.sample_data.whats_included')}
        </h4>
        <div className="space-y-4">
          {sampleDataItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <h5 className="font-medium text-sm">{t(item.titleKey)}</h5>
                  <p className="text-xs text-muted-foreground mt-1">{t(item.descriptionKey)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseOnboardingModal>
  );
}