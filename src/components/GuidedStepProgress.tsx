import { useEffect, useState } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronRight } from "lucide-react";

export function GuidedStepProgress() {
  const { steps, currentStep, completedSteps, inGuidedSetup } = useOnboarding();
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const progressPercentage = (completedSteps.length / steps.length) * 100;

  useEffect(() => {
    // Animate progress bar
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 300);

    return () => clearTimeout(timer);
  }, [progressPercentage]);

  if (!inGuidedSetup) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Getting Started</h2>
          <span className="text-sm text-muted-foreground">
            {completedSteps.length} of {steps.length} completed
          </span>
        </div>
        <Progress 
          value={animatedProgress} 
          className="h-2 transition-all duration-700 ease-out"
        />
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                isCurrent 
                  ? 'bg-primary/5 border border-primary/20' 
                  : isCompleted 
                    ? 'bg-muted/30' 
                    : 'bg-muted/10'
              }`}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                isCompleted 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : isCurrent
                    ? 'border-primary text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold">{step.id}</span>
                )}
              </div>
              
              <div className="flex-1">
                <h3 className={`font-medium text-sm transition-colors ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
              </div>

              {isCurrent && (
                <ChevronRight className="h-4 w-4 text-primary animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}