import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";  
import { HelpCircle, ArrowRight, CheckCircle } from "lucide-react";
import { SampleDataModal } from "@/components/SampleDataModal";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { ExitGuidanceModeButton } from "@/components/ExitGuidanceModeButton";
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
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const { completedCount, loading } = useOnboarding();
  
  // Simple logic
  const allCompleted = completedCount >= 5;
  const currentStep = allCompleted ? null : onboardingSteps[completedCount];
  const nextStep = currentStep ? onboardingSteps[completedCount + 1] : null;

  const handleStepAction = (step: any) => {
    if (step.id === 1) {
      navigate(`${step.route}?tutorial=true`);
    } else {
      navigate(step.route);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
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
                {completedCount > 0 && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <GuidedStepProgress 
                  currentValue={completedCount}
                  targetValue={completedCount}
                  totalSteps={5}
                  animate={true}
                />
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

        {/* Current Task */}
        {currentStep && (
          <div className="mb-6 sm:mb-8">
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground text-lg font-bold">
                        {currentStep.id}
                      </div>
                      <CardTitle className="text-xl">
                        {currentStep.title}
                      </CardTitle>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        {currentStep.duration}
                      </span>
                    </div>
                    <CardDescription className="text-base text-muted-foreground ml-14">
                      {currentStep.description}
                    </CardDescription>
                  </div>
                  <div className="ml-8">
                    <Button 
                      size="lg" 
                      onClick={() => handleStepAction(currentStep)}
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

        {/* Completion */}
        {allCompleted && (
          <div className="text-center">
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <CardContent className="py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                  Congratulations! 🎉
                </h2>
                <p className="text-green-600 dark:text-green-300 mb-6">
                  You've completed the guided setup!
                </p>
                <Button 
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700"
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

      <SampleDataModal 
        open={showSampleDataModal}
        onClose={() => setShowSampleDataModal(false)}
      />

      <RestartGuidedModeButton />
      <ExitGuidanceModeButton />
    </div>
  );
};

export default GettingStarted;