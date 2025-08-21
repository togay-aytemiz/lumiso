import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "@/hooks/use-toast";

export function RestartGuidedModeButton() {
  const { user } = useAuth();
  const { resetGuidedSetup } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);

  // Only show for the specific user
  if (!user || user.email !== 'togayaytemiz@gmail.com') {
    return null;
  }

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      await resetGuidedSetup();
      toast({
        title: "Guided mode reset",
        description: "The onboarding modal will appear on your next page refresh.",
      });
      // Refresh the page to trigger the onboarding modal
      window.location.reload();
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