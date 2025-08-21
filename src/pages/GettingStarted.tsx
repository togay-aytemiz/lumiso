import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, ArrowRight, CheckCircle } from "lucide-react";
import { SampleDataModal } from "@/components/SampleDataModal";
import { DeveloperSettings } from "@/components/DeveloperSettings";
import { GuidedStepProgress } from "@/components/GuidedStepProgress";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";

const onboardingSteps = [
  {
    id: 1,
    title: "Complete Your Profile Setup",
    description: "Add your business details and contact information",
    route: "/settings/profile",
    buttonText: "Set Up Profile",
    duration: "3 min"
  },
  {
    id: 2, 
    title: "Create Your First Lead",
    description: "Add a potential client to start tracking opportunities",
    route: "/leads",
    buttonText: "Go to Leads",
    duration: "2 min"
  },
  {
    id: 3,
    title: "Set Up a Photography Project", 
    description: "Create your first project to organize sessions and deliverables",
    route: "/projects",
    buttonText: "Create Project",
    duration: "4 min"
  },
  {
    id: 4,
    title: "Schedule a Photo Session",
    description: "Book your first session and manage your calendar",
    route: "/calendar", 
    buttonText: "Schedule Session",
    duration: "3 min"
  },
  {
    id: 5,
    title: "Configure Your Packages",
    description: "Set up photography packages and pricing structure",
    route: "/settings/services",
    buttonText: "Set Up Packages",
    duration: "5 min"
  }
];

const GettingStarted = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentStep: currentStepNumber, completedSteps, guidanceCompleted } = useOnboarding();
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  
  const currentStepIndex = currentStepNumber - 1; // Convert 1-based to 0-based
  const currentStep = onboardingSteps[currentStepIndex];
  const nextStep = onboardingSteps[currentStepIndex + 1];
  const progressPercentage = (completedSteps.length / onboardingSteps.length) * 100;

  const handleStepAction = (route: string) => {
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Header for Guidance Mode */}
      <div className="bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-6 gap-6">
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Welcome to Lumiso! 🎉</h1>
            <p className="text-sm text-muted-foreground mt-2">Let's set up your photography business step by step</p>
          </div>
          <div className="flex items-center justify-center sm:justify-end gap-3">
            <Button variant="outline" size="sm">
              <HelpCircle className="w-4 h-4 mr-2" />
              Need Help?
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowSampleDataModal(true)}
            >
              Skip Setup
            </Button>
          </div>
        </div>
      </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-safe">
        {/* Progress Section */}
        <div className="mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                Setup Progress
                {completedSteps.length > 0 && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </CardTitle>
              <CardDescription className="text-base">
                Track your guided setup progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GuidedStepProgress 
                currentStep={currentStepNumber}
                completedSteps={completedSteps}
                totalSteps={onboardingSteps.length}
              />
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <div className="font-medium">
                    <span className="text-foreground">Now:</span> {currentStep ? currentStep.title : "All tasks complete! 🎉"}
                  </div>
                  {nextStep && (
                    <div>
                      <span className="text-foreground">Next:</span> {nextStep.title}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Path Header */}
        <div className="mb-6 sm:mb-8 text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            Your Learning Path
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Each step teaches you how to use Lumiso naturally.
          </p>
        </div>

        {/* Current Task Display */}
        {currentStep && (
          <div className="mb-6 sm:mb-8">
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-4 md:p-6">
                {/* Mobile Layout */}
                <div className="block md:hidden">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-lg font-bold flex-shrink-0">
                      {currentStep.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-2">
                        {currentStep.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {currentStep.description}
                      </CardDescription>
                      <div className="mt-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          {currentStep.duration}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button 
                    size="lg" 
                    className="w-full min-h-[48px]"
                    onClick={() => handleStepAction(currentStep.route)}
                  >
                    {currentStep.buttonText}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:flex md:items-center md:justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Title Row with Circle, Title, and Duration Badge */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-lg font-bold flex-shrink-0">
                        {currentStep.id}
                      </div>
                      <CardTitle className="text-xl">
                        {currentStep.title}
                      </CardTitle>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground ml-2">
                        {currentStep.duration}
                      </span>
                    </div>
                    {/* Description */}
                    <CardDescription className="text-base text-muted-foreground ml-14">
                      {currentStep.description}
                    </CardDescription>
                  </div>
                  
                  {/* CTA Button on Right */}
                  <div className="ml-8 flex-shrink-0">
                    <Button 
                      size="lg" 
                      className="min-h-[48px]"
                      onClick={() => handleStepAction(currentStep.route)}
                    >
                      {currentStep.buttonText}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Next Step Preview */}
        {nextStep && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px bg-border flex-1"></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide px-3">Coming Next</span>
              <div className="h-px bg-border flex-1"></div>
            </div>
            
            <Card className="opacity-50 pointer-events-none grayscale-[0.3]">
              <CardContent className="p-4 md:p-6">
                {/* Mobile Layout */}
                <div className="block md:hidden">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-muted-foreground/30 text-muted-foreground text-lg font-bold flex-shrink-0">
                      {nextStep.id}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-2 text-muted-foreground">
                        {nextStep.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground/80">
                        {nextStep.description}
                      </CardDescription>
                      <div className="mt-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground/80">
                          {nextStep.duration}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:block">
                  {/* Title Row with Circle, Title, and Duration Badge */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-muted-foreground/30 text-muted-foreground text-lg font-bold flex-shrink-0">
                      {nextStep.id}
                    </div>
                    <CardTitle className="text-xl text-muted-foreground">
                      {nextStep.title}
                    </CardTitle>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted/50 text-muted-foreground/80 ml-2">
                      {nextStep.duration}
                    </span>
                  </div>
                  {/* Description */}
                  <CardDescription className="text-base text-muted-foreground/80 ml-14">
                    {nextStep.description}
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Completion State */}
        {(guidanceCompleted || !currentStep) && (
          <div className="text-center">
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <CardContent className="py-12">
                <div className="mb-4">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto animate-scale-in" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                  Congratulations! 🎉
                </h2>
                <p className="text-green-600 dark:text-green-300 mb-6 text-sm sm:text-base">
                  You've completed the guided setup! Your photography CRM is ready to use.
                </p>
                <Button 
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700 min-h-[48px]"
                  onClick={() => navigate('/')}
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Sample Data Modal */}
      <SampleDataModal 
        open={showSampleDataModal}
        onClose={() => setShowSampleDataModal(false)}
      />

      {/* Developer Settings */}
      <DeveloperSettings />
    </div>
  );
};

export default GettingStarted;