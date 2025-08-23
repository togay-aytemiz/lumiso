import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function ExitGuidanceModeButton() {
  const { user } = useAuth();
  const { completeOnboarding, shouldLockNavigation } = useOnboardingV2();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Only show for the specific user AND when in guided setup
  if (!user || user.email !== 'togayaytemiz@gmail.com' || !shouldLockNavigation) {
    return null;
  }

  const handleExit = async () => {
    console.log('🚪 Exit guidance mode clicked');
    setIsLoading(true);
    try {
      console.log('🚪 Calling completeOnboarding...');
      await completeOnboarding();
      console.log('✅ completeOnboarding finished successfully');
      toast({
        title: "Exited guidance mode",
        description: "You can now access all features.",
      });
      // Don't navigate manually - let the app's redirect logic handle it
      console.log('🚪 Onboarding completed, app will redirect automatically');
    } catch (error) {
      console.error('❌ Error exiting guidance mode:', error);
      toast({
        title: "Error",
        description: "Failed to exit guidance mode. Please try again.",
        variant: "destructive"
      });
    } finally {
      console.log('🚪 Setting loading to false');
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
        {isLoading ? "Exiting..." : "Exit Guidance"}
      </Button>
    </div>
  );
}