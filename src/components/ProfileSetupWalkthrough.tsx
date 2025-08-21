import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, ChevronRight, CheckCircle, ArrowRight, Menu, Settings as SettingsIcon } from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: 'click' | 'navigate' | 'highlight';
  nextRoute?: string;
  waitForRoute?: string;
}

const desktopSteps: WalkthroughStep[] = [
  {
    id: 'settings-nav',
    title: 'Navigate to Settings',
    description: 'Click on Settings in the sidebar to begin setting up your profile.',
    targetSelector: '[data-walkthrough="settings-nav"]',
    position: 'right',
    action: 'click',
    nextRoute: '/settings',
    waitForRoute: '/settings'
  },
  {
    id: 'profile-section',
    title: 'Go to Profile Section',
    description: 'Click on Profile to set up your personal information first.',
    targetSelector: '[data-walkthrough="profile-section"]',
    position: 'right',
    action: 'click',
    nextRoute: '/settings/profile',
    waitForRoute: '/settings/profile'
  },
  {
    id: 'profile-fields',
    title: 'Fill Your Profile',
    description: 'Enter your full name and phone number, then save your changes.',
    targetSelector: '[data-walkthrough="profile-form"]',
    position: 'left',
    action: 'highlight'
  },
  {
    id: 'general-section',
    title: 'Complete General Settings',
    description: 'Now go to General settings to add your business information.',
    targetSelector: '[data-walkthrough="general-section"]',
    position: 'right',
    action: 'click',
    nextRoute: '/settings/general',
    waitForRoute: '/settings/general'
  },
  {
    id: 'business-info',
    title: 'Add Business Details',
    description: 'Enter your photography business name and save your settings.',
    targetSelector: '[data-walkthrough="business-form"]',
    position: 'left',
    action: 'highlight'
  }
];

const mobileSteps: WalkthroughStep[] = [
  {
    id: 'mobile-more-menu',
    title: 'Open More Menu',
    description: 'Tap the "More" tab in the bottom navigation to access additional options.',
    targetSelector: '[data-walkthrough="mobile-more-tab"]',
    position: 'top',
    action: 'click'
  },
  {
    id: 'mobile-settings',
    title: 'Go to Settings',
    description: 'Tap Settings from the menu to begin profile setup.',
    targetSelector: '[data-walkthrough="mobile-settings"]',
    position: 'center',
    action: 'click',
    nextRoute: '/settings',
    waitForRoute: '/settings'
  },
  {
    id: 'profile-section',
    title: 'Go to Profile Section',
    description: 'Tap on Profile to set up your personal information first.',
    targetSelector: '[data-walkthrough="profile-section"]',
    position: 'right',
    action: 'click',
    nextRoute: '/settings/profile',
    waitForRoute: '/settings/profile'
  },
  {
    id: 'profile-fields',
    title: 'Fill Your Profile',
    description: 'Enter your full name and phone number, then save your changes.',
    targetSelector: '[data-walkthrough="profile-form"]',
    position: 'top',
    action: 'highlight'
  },
  {
    id: 'general-section',
    title: 'Complete General Settings',
    description: 'Now tap General settings to add your business information.',
    targetSelector: '[data-walkthrough="general-section"]',
    position: 'right',
    action: 'click',
    nextRoute: '/settings/general',
    waitForRoute: '/settings/general'
  },
  {
    id: 'business-info',
    title: 'Add Business Details',
    description: 'Enter your photography business name and save your settings.',
    targetSelector: '[data-walkthrough="business-form"]',
    position: 'top',
    action: 'highlight'
  }
];

export function ProfileSetupWalkthrough() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { inGuidedSetup, currentStep, advanceStep } = useOnboarding();
  
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const steps = isMobile ? mobileSteps : desktopSteps;
  const currentWalkthroughStep = steps[currentStepIndex];

  // Start walkthrough when triggered
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('walkthrough') === 'profile-setup' && inGuidedSetup && currentStep === 1) {
      setIsActive(true);
      addHighlights();
      
      // For mobile, ensure mobile nav is visible
      if (isMobile) {
        const mobileNav = document.querySelector('.mobile-bottom-nav');
        if (mobileNav) {
          (mobileNav as HTMLElement).style.display = 'block';
        }
      }
    }
  }, [location.search, inGuidedSetup, currentStep, isMobile]);

  // Handle route changes for step progression
  useEffect(() => {
    if (!isActive || !currentWalkthroughStep) return;

    if (currentWalkthroughStep.waitForRoute && location.pathname === currentWalkthroughStep.waitForRoute) {
      // Wait a bit for the page to render, then advance to next step
      setTimeout(() => {
        handleNextStep();
      }, 500);
    }
  }, [location.pathname, isActive, currentWalkthroughStep]);

  const addHighlights = () => {
    removeHighlights();
    if (!currentWalkthroughStep) return;

    setTimeout(() => {
      const elements = document.querySelectorAll(currentWalkthroughStep.targetSelector);
      elements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.classList.add('walkthrough-highlight');
          
          // For clickable elements, add click handler
          if (currentWalkthroughStep.action === 'click') {
            el.classList.add('walkthrough-clickable');
            el.addEventListener('click', handleStepAction);
          }
        }
      });
    }, 300);
  };

  const removeHighlights = () => {
    document.querySelectorAll('.walkthrough-highlight').forEach(el => {
      el.classList.remove('walkthrough-highlight', 'walkthrough-clickable');
      el.removeEventListener('click', handleStepAction);
    });
  };

  const handleStepAction = () => {
    if (!currentWalkthroughStep) return;

    if (currentWalkthroughStep.action === 'click' && currentWalkthroughStep.nextRoute) {
      navigate(currentWalkthroughStep.nextRoute);
    } else {
      handleNextStep();
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
      setTimeout(() => addHighlights(), 100);
    } else {
      // Walkthrough completed
      handleComplete();
    }
  };

  const handleSkip = () => {
    setIsActive(false);
    removeHighlights();
    handleComplete();
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    removeHighlights();
    
    try {
      await advanceStep(1);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error completing walkthrough:', error);
      toast({
        title: "Error",
        description: "Failed to complete walkthrough. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleContinueSetup = () => {
    setShowSuccessModal(false);
    setIsActive(false);
    navigate('/getting-started');
  };

  if (!isActive || !currentWalkthroughStep) {
    return null;
  }

  return (
    <>
      {/* Mobile guidance - bottom sheet */}
      {isMobile && (
        <div className="fixed inset-x-0 bottom-20 z-50 md:hidden">
          <Card className="mx-4 shadow-2xl animate-slide-up border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Step {currentStepIndex + 1}/{steps.length}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-accent">
                    Profile Setup
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="h-8 w-8 p-0"
                  disabled={isCompleting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-base">{currentWalkthroughStep.title}</CardTitle>
              <CardDescription className="text-sm">
                {currentWalkthroughStep.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                {currentWalkthroughStep.action === 'highlight' && (
                  <Button 
                    onClick={handleNextStep}
                    disabled={isCompleting}
                    className="flex-1"
                    size="sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Continue
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={handleSkip}
                  disabled={isCompleting}
                  size="sm"
                  className="flex-shrink-0"
                >
                  Skip Walkthrough
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desktop guidance - floating card */}
      {!isMobile && (
        <div className="fixed top-20 right-6 z-50 hidden md:block max-w-sm">
          <Card className={cn(
            "shadow-xl border animate-fade-in",
            isCompleting && "opacity-50"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    Step {currentStepIndex + 1}/{steps.length}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-accent">
                    Profile Setup
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkip}
                  className="h-8 w-8 p-0"
                  disabled={isCompleting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-base">{currentWalkthroughStep.title}</CardTitle>
              <CardDescription className="text-sm">
                {currentWalkthroughStep.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {currentWalkthroughStep.action === 'highlight' && (
                  <Button 
                    onClick={handleNextStep}
                    disabled={isCompleting}
                    className="w-full"
                    size="sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Continue
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={handleSkip}
                  disabled={isCompleting}
                  className="w-full"
                  size="sm"
                >
                  Skip Walkthrough
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-center">Profile Setup Complete!</DialogTitle>
            <DialogDescription className="text-center">
              Great job! You've successfully set up your profile and business information. 
              Your photography CRM is now personalized and ready for the next step.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleContinueSetup} className="w-full">
              <ArrowRight className="w-4 h-4 mr-2" />
              Continue Setup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}