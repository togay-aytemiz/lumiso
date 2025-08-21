import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, RefreshCw, RotateCcw } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";

export const DeveloperSettings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { setStep, resetOnboardingState, currentStep, completedSteps } = useOnboarding();

  const handleSetStep = async (stepStr: string) => {
    const step = parseInt(stepStr);
    try {
      await setStep(step);
      // Navigate to getting-started to see the changes
      window.location.href = '/getting-started';
    } catch (error) {
      console.error('Failed to set step:', error);
    }
  };

  const handleReset = async () => {
    try {
      await resetOnboardingState();
      window.location.href = '/getting-started';
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full w-12 h-12 p-0 shadow-lg"
        variant="outline"
      >
        <Settings className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Developer Settings</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsOpen(false)}
            className="w-6 h-6 p-0"
          >
            ×
          </Button>
        </div>
        <CardDescription className="text-xs">
          Current: Step {currentStep} | Completed: [{completedSteps.join(', ')}]
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium">Jump to Step:</label>
          <Select onValueChange={handleSetStep}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select step" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Step 1: Profile Setup</SelectItem>
              <SelectItem value="2">Step 2: Create Lead</SelectItem>
              <SelectItem value="3">Step 3: Create Project</SelectItem>
              <SelectItem value="4">Step 4: Schedule Session</SelectItem>
              <SelectItem value="5">Step 5: Configure Packages</SelectItem>
              <SelectItem value="6">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button 
          onClick={handleReset}
          variant="outline" 
          size="sm" 
          className="w-full h-8"
        >
          <RotateCcw className="w-3 h-3 mr-1" />
          Reset to Start
        </Button>
      </CardContent>
    </Card>
  );
};