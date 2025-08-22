import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function RestartGuidedModeButton() {
  const { user } = useAuth();
  const { resetOnboarding } = useOnboardingV2();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Only show for the specific user
  if (!user || user.email !== 'togayaytemiz@gmail.com') {
    return null;
  }

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      await resetOnboarding();
      toast({
        title: "Guided mode reset",
        description: "Restarting guided mode...",
      });
      // Navigate to getting started to trigger the onboarding modal
      navigate('/getting-started');
    } catch (error) {
      console.error('Error restarting guided mode:', error);
      toast({
        title: "Error",
        description: "Failed to reset guided mode. Please try again.",
        variant: "destructive"
      });
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
        {isLoading ? "Restarting..." : "Restart Guided Mode"}
      </Button>
    </div>
  );
}