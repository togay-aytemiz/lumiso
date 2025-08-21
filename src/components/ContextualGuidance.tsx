import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronRight, CheckCircle } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const onboardingSteps = [
  {
    id: 1,
    title: "Complete Your Profile Setup",
    description: "Add your business details and contact information to personalize your workspace",
    route: "/settings/profile",
    actionText: "Complete Profile",
    highlightSelector: ".profile-form, [data-step-highlight='profile']",
    guidance: "Fill out your business name, contact details, and upload a logo to get started."
  },
  {
    id: 2, 
    title: "Create Your First Lead",
    description: "Add a potential client to start tracking opportunities",
    route: "/leads",
    actionText: "Add Lead",
    highlightSelector: "[data-testid='add-lead-button'], .add-lead-button, button:contains('Add Lead')",
    guidance: "Click the 'Add Lead' button to create your first potential client record."
  },
  {
    id: 3,
    title: "Set Up a Photography Project", 
    description: "Create your first project to organize sessions and deliverables",
    route: "/projects",
    actionText: "Create Project",
    highlightSelector: "[data-testid='add-project-button'], .add-project-button, button:contains('Add Project')",
    guidance: "Click 'Add Project' to create your first photography project from a lead."
  },
  {
    id: 4,
    title: "Schedule a Photo Session",
    description: "Book your first session and manage your calendar",
    route: "/calendar", 
    actionText: "Schedule Session",
    highlightSelector: "[data-testid='add-session-button'], .add-session-button, button:contains('Add Session')",
    guidance: "Use the calendar to schedule your first photography session."
  },
  {
    id: 5,
    title: "Configure Your Packages",
    description: "Set up photography packages and pricing structure",
    route: "/settings/services",
    actionText: "Set Up Packages",
    highlightSelector: "[data-testid='add-package-button'], .add-package-button, button:contains('Add Package')",
    guidance: "Create your first photography package with pricing and services included."
  }
];

export function ContextualGuidance() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { inGuidedSetup, currentStep, advanceStep } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Find current step based on route
  const currentStepData = onboardingSteps.find(step => 
    step.route === location.pathname && step.id === currentStep
  );

  // Show guidance if in guided setup and on correct page
  useEffect(() => {
    if (inGuidedSetup && currentStepData) {
      // Delay to allow page to render first
      setTimeout(() => {
        setIsVisible(true);
        // Add highlight to target elements
        addHighlights(currentStepData.highlightSelector);
      }, 500);
    } else {
      setIsVisible(false);
      removeHighlights();
    }

    return () => removeHighlights();
  }, [inGuidedSetup, currentStepData, location.pathname]);

  const addHighlights = (selector: string) => {
    try {
      // Try multiple selectors
      const selectors = selector.split(', ');
      let found = false;
      
      selectors.forEach(sel => {
        const elements = document.querySelectorAll(sel.trim());
        elements.forEach(el => {
          if (el instanceof HTMLElement) {
            el.classList.add('guidance-highlight');
            found = true;
          }
        });
      });

      // If no elements found with selectors, try common button patterns
      if (!found) {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          const text = button.textContent?.toLowerCase() || '';
          if (
            text.includes('add lead') || 
            text.includes('add project') || 
            text.includes('add session') ||
            text.includes('add package') ||
            text.includes('create')
          ) {
            button.classList.add('guidance-highlight');
          }
        });
      }
    } catch (error) {
      console.warn('Error adding highlights:', error);
    }
  };

  const removeHighlights = () => {
    document.querySelectorAll('.guidance-highlight').forEach(el => {
      el.classList.remove('guidance-highlight');
    });
  };

  const handleSkip = async () => {
    if (!currentStepData) return;
    
    setIsAnimating(true);
    
    try {
      await advanceStep(currentStepData.id);
      
      toast({
        title: "Step skipped",
        description: `${currentStepData.title} has been marked as completed.`,
        variant: "default",
      });

      // Navigate back to getting started with a brief delay for animation
      setTimeout(() => {
        navigate('/getting-started');
      }, 300);
      
    } catch (error) {
      console.error('Error skipping step:', error);
      toast({
        title: "Error",
        description: "Failed to skip step. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnimating(false);
    }
  };

  const handleComplete = async () => {
    if (!currentStepData) return;
    
    setIsAnimating(true);
    
    try {
      await advanceStep(currentStepData.id);
      
      toast({
        title: "Step completed!",
        description: `Great job completing: ${currentStepData.title}`,
        variant: "default",
      });

      setTimeout(() => {
        navigate('/getting-started');
      }, 300);
      
    } catch (error) {
      console.error('Error completing step:', error);
      toast({
        title: "Error", 
        description: "Failed to complete step. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnimating(false);
    }
  };

  if (!isVisible || !currentStepData) {
    return null;
  }

  return (
    <>
      {/* Mobile guidance - bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <Card className="rounded-t-xl border-t border-x-0 border-b-0 shadow-2xl animate-slide-up">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Step {currentStepData.id}/5
                </Badge>
                <Badge variant="outline" className="text-xs text-accent">
                  Guided Setup
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
            <CardDescription className="text-sm">
              {currentStepData.guidance}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2">
              <Button 
                onClick={handleComplete}
                disabled={isAnimating}
                className="flex-1"
                size="sm"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isAnimating ? "Processing..." : currentStepData.actionText}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleSkip}
                disabled={isAnimating}
                size="sm"
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Desktop guidance - floating card */}
      <div className="fixed top-20 right-6 z-50 hidden md:block max-w-sm">
        <Card className={cn(
          "shadow-xl border animate-fade-in",
          isAnimating && "opacity-50"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Step {currentStepData.id}/5
                </Badge>
                <Badge variant="outline" className="text-xs text-accent">
                  Setup Guide
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardTitle className="text-base">{currentStepData.title}</CardTitle>
            <CardDescription className="text-sm">
              {currentStepData.guidance}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Button 
                onClick={handleComplete}
                disabled={isAnimating}
                className="w-full"
                size="sm"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {isAnimating ? "Processing..." : currentStepData.actionText}
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleSkip}
                disabled={isAnimating}
                className="w-full"
                size="sm"
              >
                Skip for now
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}