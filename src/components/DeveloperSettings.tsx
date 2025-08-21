import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, RotateCcw, LogOut, Play } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "@/hooks/use-toast";

export function DeveloperSettings() {
  const { user } = useAuth();
  const { resetOnboardingState, setStep, skipWithSampleData } = useOnboarding();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStep, setSelectedStep] = useState<string>("1");
  const [open, setOpen] = useState(false);

  // Only show for the specific user
  if (!user || user.email !== 'togayaytemiz@gmail.com') {
    return null;
  }

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      await resetOnboardingState();
      toast({
        title: "Guided mode reset",
        description: "Guided setup has been reset to step 1.",
      });
      setOpen(false);
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

  const handleSetStep = async () => {
    setIsLoading(true);
    try {
      await setStep(parseInt(selectedStep));
      toast({
        title: "Step set",
        description: `Guided setup moved to step ${selectedStep}.`,
      });
      setOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error setting step:', error);
      toast({
        title: "Error",
        description: "Failed to set step. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitGuidance = async () => {
    setIsLoading(true);
    try {
      await skipWithSampleData();
      toast({
        title: "Exited guided mode",
        description: "You've exited the guided setup process.",
      });
      setOpen(false);
      window.location.href = '/';
    } catch (error) {
      console.error('Error exiting guidance:', error);
      toast({
        title: "Error",
        description: "Failed to exit guided mode. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="shadow-lg border-primary/20 bg-background/80 backdrop-blur-sm hover:bg-primary/5"
          >
            <Settings className="w-4 h-4 mr-2" />
            Developer Settings
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Developer Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Reset to Step 1 */}
            <div className="space-y-2">
              <Button
                onClick={handleRestart}
                disabled={isLoading}
                variant="outline"
                className="w-full justify-start"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {isLoading ? "Restarting..." : "Reset to Step 1"}
              </Button>
            </div>

            {/* Jump to Specific Step */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Jump to Step:</label>
              <div className="flex gap-2">
                <Select value={selectedStep} onValueChange={setSelectedStep}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Step 1: Profile Setup</SelectItem>
                    <SelectItem value="2">Step 2: Create Lead</SelectItem>
                    <SelectItem value="3">Step 3: Create Project</SelectItem>
                    <SelectItem value="4">Step 4: Schedule Session</SelectItem>
                    <SelectItem value="5">Step 5: Configure Packages</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleSetStep}
                  disabled={isLoading}
                  size="sm"
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Exit Guidance Mode */}
            <div className="space-y-2">
              <Button
                onClick={handleExitGuidance}
                disabled={isLoading}
                variant="destructive"
                className="w-full justify-start"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isLoading ? "Exiting..." : "Exit Guidance Mode"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}