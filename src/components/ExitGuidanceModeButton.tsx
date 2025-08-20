import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "@/hooks/use-toast";

export function ExitGuidanceModeButton() {
  const { user } = useAuth();
  const { skipWithSampleData } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);

  // Only show for the specific user
  if (!user || user.email !== 'togayaytemiz@gmail.com') {
    return null;
  }

  const handleExit = async () => {
    setIsLoading(true);
    try {
      await skipWithSampleData();
      toast({
        title: "Exited guidance mode",
        description: "You can now access all features.",
      });
      // Navigate to dashboard
      window.location.href = '/';
    } catch (error) {
      console.error('Error exiting guidance mode:', error);
      toast({
        title: "Error",
        description: "Failed to exit guidance mode. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
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