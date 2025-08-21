import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface GuidedStepProgressProps {
  completedSteps: number[];
  currentStep: number;
  totalSteps: number;
}

export const GuidedStepProgress = ({ completedSteps, currentStep, totalSteps }: GuidedStepProgressProps) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const targetProgress = (completedSteps.length / totalSteps) * 100;

  // Animate progress bar
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(targetProgress);
    }, 300);
    return () => clearTimeout(timer);
  }, [targetProgress]);

  const getCurrentStepTitle = () => {
    const steps = [
      "Complete Your Profile Setup",
      "Create Your First Lead", 
      "Set Up a Photography Project",
      "Schedule a Photo Session",
      "Configure Your Packages"
    ];
    
    if (completedSteps.length >= totalSteps) {
      return "All tasks complete! 🎉";
    }
    
    return steps[currentStep - 1] || "Getting started...";
  };

  const getNextStepTitle = () => {
    const steps = [
      "Complete Your Profile Setup",
      "Create Your First Lead",
      "Set Up a Photography Project", 
      "Schedule a Photo Session",
      "Configure Your Packages"
    ];
    
    return steps[currentStep] || null;
  };

  return (
    <Card className="transition-all duration-500 ease-in-out">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl transition-all duration-300">
          Setup Progress
          {completedSteps.length > 0 && (
            <CheckCircle className="w-5 h-5 text-green-500 animate-scale-in" />
          )}
        </CardTitle>
        <CardDescription className="text-base">
          {completedSteps.length}/{totalSteps} Tasks Complete
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Progress 
            value={animatedProgress} 
            className="w-full h-2 transition-all duration-700 ease-out" 
          />
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="font-medium transition-all duration-300">
              <span className="text-foreground">Now:</span> {getCurrentStepTitle()}
            </div>
            {getNextStepTitle() && (
              <div className="transition-all duration-300 animate-fade-in">
                <span className="text-foreground">Next:</span> {getNextStepTitle()}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};