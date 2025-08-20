import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { toast } from "@/hooks/use-toast";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

const onboardingSteps = [
  "Complete your profile setup",
  "Create your first client lead",
  "Set up a photography project", 
  "Schedule a photo session",
  "Configure your packages"
];

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startGuidedSetup, skipWithSampleData } = useOnboarding();

  const handleStartLearning = async () => {
    if (!user) return;
    
    console.log('handleStartLearning: Starting...');
    setIsLoading(true);
    try {
      await startGuidedSetup();
      console.log('handleStartLearning: startGuidedSetup completed, calling onClose...');
      
      onClose();
      navigate('/getting-started');
      toast({
        title: "Welcome to Lumiso! 🎉",
        description: "Let's get you set up step by step.",
      });
      console.log('handleStartLearning: All completed');
    } catch (error) {
      console.error('Error starting guided setup:', error);
      toast({
        title: "Error",
        description: "Failed to start guided setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipWithSampleData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await skipWithSampleData();
      
      onClose();
      toast({
        title: "Sample data loaded",
        description: "You can explore Lumiso with sample data and start fresh when ready.",
      });
    } catch (error) {
      console.error('Error skipping with sample data:', error);
      toast({
        title: "Error",
        description: "Failed to skip setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto md:max-h-none md:h-auto h-full md:rounded-lg rounded-none">
        <DialogHeader className="text-center space-y-4">
          <DialogTitle className="text-2xl font-bold text-primary">
            Welcome to Lumiso! 🎉
          </DialogTitle>
          <p className="text-muted-foreground text-base leading-relaxed">
            We'll guide you through setting up your photography CRM step by step. 
            Each task builds on the previous one, so you'll learn naturally.
          </p>
        </DialogHeader>

        <div className="space-y-4 my-6">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            What you'll learn:
          </h4>
          <div className="space-y-3">
            {onboardingSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{index + 1}</span>
                </div>
                <span className="text-sm text-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            onClick={handleStartLearning}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            {isLoading ? "Starting..." : "Start Learning!"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSkipWithSampleData}
            disabled={isLoading}
            className="flex-1"
          >
            Skip & Use Sample Data
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}