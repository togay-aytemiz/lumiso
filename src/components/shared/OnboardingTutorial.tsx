import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";

export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  content: React.ReactNode;
  canProceed: boolean;
  route?: string; // Optional route to navigate to for this step
}

interface OnboardingTutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onExit: () => void;
  isVisible: boolean;
}

export function OnboardingTutorial({ 
  steps, 
  onComplete, 
  onExit, 
  isVisible 
}: OnboardingTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const navigate = useNavigate();
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  // Navigate to step route if specified
  useEffect(() => {
    if (currentStep?.route && currentStepIndex > 0) {
      navigate(currentStep.route);
    }
  }, [currentStep?.route, currentStepIndex, navigate]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleExit = () => {
    onExit();
  };

  if (!isVisible || !currentStep) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {currentStep.id}
              </div>
              <div>
                <CardTitle className="text-lg">{currentStep.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  Step {currentStepIndex + 1} of {steps.length}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExit}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            {currentStep.description}
          </p>

          {currentStep.content && (
            <div className="p-4 bg-muted/30 rounded-lg">
              {currentStep.content}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleExit}
              className="order-2 sm:order-1"
            >
              Exit Tutorial
            </Button>
            <Button
              onClick={handleNext}
              disabled={!currentStep.canProceed}
              className="order-1 sm:order-2 sm:ml-auto"
            >
              {isLastStep ? "Complete Setup" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}