import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";

interface GuidedStepProgressProps {
  currentValue: number;
  targetValue: number;
  totalSteps: number;
  animate?: boolean;
}

export function GuidedStepProgress({ 
  currentValue, 
  targetValue, 
  totalSteps, 
  animate = true 
}: GuidedStepProgressProps) {
  const [displayValue, setDisplayValue] = useState(currentValue);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(targetValue);
      return;
    }

    if (targetValue !== currentValue) {
      const duration = 800; // Animation duration in ms
      const steps = Math.abs(targetValue - currentValue) * 10; // More steps for smoother animation
      const increment = (targetValue - currentValue) / steps;
      const stepDuration = duration / steps;

      let step = 0;
      const timer = setInterval(() => {
        step++;
        if (step >= steps) {
          setDisplayValue(targetValue);
          clearInterval(timer);
        } else {
          setDisplayValue(currentValue + (increment * step));
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }
  }, [currentValue, targetValue, animate]);

  const progressPercentage = (displayValue / totalSteps) * 100;

  return (
    <div className="space-y-4">
      <Progress 
        value={progressPercentage} 
        className="w-full h-2 transition-all duration-300" 
      />
      <div className="text-sm text-muted-foreground">
        <span className="tabular-nums font-medium text-foreground">
          {Math.round(displayValue)}/{totalSteps}
        </span> Tasks Complete
      </div>
    </div>
  );
}