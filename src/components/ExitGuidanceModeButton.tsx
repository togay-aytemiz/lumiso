import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useI18nToast } from "@/lib/toastHelpers";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function ExitGuidanceModeButton() {
  const { t } = useTranslation('pages');
  const toast = useI18nToast();
  const { user } = useAuth();
  const { completeOnboarding, shouldLockNavigation } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Only show for the specific user AND when in guided setup
  if (!user || user.email !== 'togayaytemiz@gmail.com' || !shouldLockNavigation) {
    return null;
  }

  const handleExit = async () => {
    setIsLoading(true);
    try {
      await completeOnboarding();
      toast.success(t('onboarding.buttons.toast.exit_description'));
    } catch (error) {
      console.error('❌ Error exiting guidance mode:', error);
      toast.error(t('onboarding.buttons.toast.exit_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-16 right-4 z-50">
      <Button
        onClick={handleExit}
        disabled={isLoading}
        size="sm"
        variant="outline"
        className="shadow-lg border-red-500/20 bg-background/80 backdrop-blur-sm hover:bg-red-500/5"
      >
        <X className="w-4 h-4 mr-2" />
        {isLoading ? t('onboarding.buttons.exiting') : t('onboarding.buttons.exit_guidance')}
      </Button>
    </div>
  );
}