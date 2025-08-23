import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOnboardingV2 } from "@/hooks/useOnboardingV2";

export interface TutorialStep {
  id: number;
  title: string | React.ReactNode;
  description: string;
  content: React.ReactNode;
  canProceed: boolean;
  route?: string; // Optional route to navigate to for this step
  mode?: 'modal' | 'floating'; // Display mode - modal (blocking) or floating (non-blocking)
  requiresAction?: boolean; // If true, shows disabled state with tooltip
  disabledTooltip?: string; // Tooltip text when button is disabled
}

interface OnboardingTutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onExit: () => void;
  isVisible: boolean;
  initialStepIndex?: number;
}

export function OnboardingTutorial({ 
  steps, 
  onComplete, 
  onExit, 
  isVisible,
  initialStepIndex = 0
}: OnboardingTutorialProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const navigate = useNavigate();
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  // Update step index when initialStepIndex changes - force update every time
  useEffect(() => {
    console.log('🔍 OnboardingTutorial: initialStepIndex changed to:', initialStepIndex, 'current internal step:', currentStepIndex);
    setCurrentStepIndex(initialStepIndex);
    console.log('✅ OnboardingTutorial: Set internal step to:', initialStepIndex);
  }, [initialStepIndex]);

  // Debug step changes
  useEffect(() => {
    console.log('🎯 OnboardingTutorial: Internal step changed to:', currentStepIndex, 'step data:', steps[currentStepIndex]);
  }, [currentStepIndex, steps]);

  // Navigate to step route if specified and pass tutorial params
  useEffect(() => {
    if (currentStep?.route && currentStepIndex > 0) {
      console.log('🚀 OnboardingTutorial: Navigating to step route:', currentStep.route, 'stepIndex:', currentStepIndex);
      // Pass tutorial state through URL parameters
      const params = new URLSearchParams();
      params.set('tutorial', 'true');
      params.set('step', (currentStepIndex + 1).toString());
      navigate(`${currentStep.route}?${params.toString()}`);
    }
  }, [currentStep?.route, currentStepIndex, navigate]);

  const handleNext = () => {
    console.log('🔄 OnboardingTutorial: handleNext called', 'currentStepIndex:', currentStepIndex, 'isLastStep:', isLastStep, 'steps.length:', steps.length);
    console.log('🔄 Current step:', steps[currentStepIndex]);
    if (isLastStep) {
      console.log('🏁 OnboardingTutorial: Completing tutorial');
      onComplete();
    } else {
      console.log('➡️ OnboardingTutorial: Advancing from step', currentStepIndex, 'to', currentStepIndex + 1);
      setCurrentStepIndex(prev => {
        const newStep = prev + 1;
        console.log('✅ OnboardingTutorial: Step updated to', newStep);
        return newStep;
      });
    }
  };

  const handleExit = () => {
    console.log('❌ OnboardingTutorial: handleExit called');
    onExit();
  };

  if (!isVisible || !currentStep) {
    return null;
  }

  const isFloatingMode = currentStep.mode === 'floating';

  if (isFloatingMode) {
    // Floating mode positioning logic
    const isProjectManagementStep = [2, 3, 4].includes(currentStep.id); // Board, List, and Archive view steps
    const isSchedulingTutorialStep = [3, 4].includes(currentStep.id); // Scheduling tutorial steps (step 3 and 4 in scheduling flow)
    const isPackagesSetupStep = [1, 2, 3].includes(currentStep.id); // Packages setup steps (step 1, 2, 3 in packages flow)
    const isAddLeadStep = currentStep.id === 2 && currentStep.title === "Add Your First Lead"; // Specific "Add Lead" step
    
    return (
      <TooltipProvider>
        <div className={`fixed z-50 max-w-sm ${
          isAddLeadStep || isSchedulingTutorialStep
            ? "right-2 top-20 sm:right-4 sm:top-20 md:right-6 md:top-24" // Right under header/search area for mobile/tablet
            : isPackagesSetupStep
              ? "right-2 bottom-16 sm:right-4 sm:bottom-4 md:right-6 md:bottom-6" // Bottom corner for packages setup
              : isProjectManagementStep 
                ? "right-2 bottom-16 sm:right-4 sm:bottom-4 md:right-6 md:bottom-6" // Bottom positioning for project management
                : "right-2 top-36 sm:right-4 sm:top-72 md:right-6 md:top-20" // Original positioning for other steps
        }`}>
          <Card className="shadow-2xl border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {currentStep.id}
                </div>
                <div>
                  <CardTitle className="text-sm">{currentStep.title}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Step {currentStepIndex + 1} of {steps.length}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <p className="text-sm text-muted-foreground">
                {currentStep.description}
              </p>

              {currentStep.content && (
                <div className="p-3 bg-muted/30 rounded-lg text-sm">
                  {currentStep.content}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExit}
                  className="flex-1 text-xs"
                >
                  Exit Tutorial
                </Button>
                {currentStep.requiresAction && !currentStep.canProceed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex-1">
                        <Button
                          size="sm"
                          disabled
                          className="w-full text-xs"
                        >
                          Next
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{currentStep.disabledTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : currentStep.canProceed ? (
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="flex-1 text-xs"
                  >
                    {isLastStep ? "Complete" : "Next"}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  // Modal mode - centered, blocking (default)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {currentStep.id}
            </div>
            <div>
              <CardTitle className="text-lg">
                {typeof currentStep.title === 'string' ? currentStep.title : currentStep.title}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </CardDescription>
            </div>
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
            {/* Only show Exit Tutorial button if not the last step */}
            {!isLastStep && (
              <Button
                variant="outline"
                onClick={handleExit}
                className="order-2 sm:order-1"
              >
                Exit Tutorial
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!currentStep.canProceed}
              className={`order-1 sm:order-2 ${!isLastStep ? 'sm:ml-auto' : 'w-full'}`}
            >
              {isLastStep ? "Continue Setup" : "Next"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}