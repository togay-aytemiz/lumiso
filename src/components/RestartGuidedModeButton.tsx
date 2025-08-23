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
    console.log('🔄 BULLETPROOF RestartButton: Restart (no modal will show)');
    setIsLoading(true);
    try {
      await resetOnboarding(); // This keeps modal permanently disabled
      toast({
        title: "Guided mode restarted",
        description: "Starting over from step 1...",
      });
      // Navigate to getting-started directly
      navigate('/getting-started');
    } catch (error) {
      console.error('❌ BULLETPROOF RestartButton: Error:', error);
      toast({
        title: "Error",
        description: "Failed to restart guided mode. Please try again.",
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