import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle } from "lucide-react";

interface GuidedStepProgressProps {
  currentStep: number;
  completedSteps: number[];
  totalSteps: number;
  className?: string;
}

export function GuidedStepProgress({ 
  currentStep, 
  completedSteps, 
  totalSteps, 
  className 
}: GuidedStepProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressPercentage = (completedSteps.length / totalSteps) * 100;

  useEffect(() => {
    // Animate progress bar on mount and when progress changes
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [progressPercentage]);

  return (
    <div className={`space-y-4 ${className}`}>
      <Progress 
        value={animatedProgress} 
        className="w-full h-2 transition-all duration-700 ease-out" 
      />
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Progress:</span>
          <span>{completedSteps.length}/{totalSteps} Tasks Complete</span>
          {completedSteps.length > 0 && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
        </div>
        {currentStep <= totalSteps && (
          <div>
            <span className="text-foreground font-medium">Current Step:</span> {currentStep}
          </div>
        )}
      </div>
    </div>
  );
}