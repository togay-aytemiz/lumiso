import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/contexts/useOnboarding";
import { useI18nToast } from "@/lib/toastHelpers";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function RestartGuidedModeButton() {
  const { t } = useTranslation('pages');
  const toast = useI18nToast();
  const { user } = useAuth();
  const { resetOnboarding } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Only show for the specific user
  if (!user || user.email !== 'togayaytemiz@gmail.com') {
    return null;
  }

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      await resetOnboarding(); // This keeps modal permanently disabled
      toast.success(t('onboarding.buttons.toast.restart_description'));
      navigate('/getting-started');
    } catch (error) {
      console.error('❌ RestartButton: Error:', error);
      toast.error(t('onboarding.buttons.toast.restart_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={handleRestart}
        disabled={isLoading}
        size="sm"
        variant="outline"
        className="shadow-lg border-primary/20 bg-background/80 backdrop-blur-sm hover:bg-primary/5"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        {isLoading ? t('onboarding.buttons.restarting') : t('onboarding.buttons.restart_guided_mode')}
      </Button>
    </div>
  );
}