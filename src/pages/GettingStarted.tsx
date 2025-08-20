import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HelpCircle, ArrowRight, CheckCircle, Play } from "lucide-react";
import { SampleDataModal } from "@/components/SampleDataModal";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { useAuth } from "@/contexts/AuthContext";

const onboardingSteps = [
  {
    id: 1,
    title: "Complete Your Profile Setup",
    description: "Add your business details, contact information, and preferences to personalize your CRM experience.",
    route: "/settings/profile",
    buttonText: "Set Up Profile"
  },
  {
    id: 2, 
    title: "Create Your First Lead",
    description: "Add a potential client to start tracking your photography opportunities and manage your sales pipeline.",
    route: "/leads",
    buttonText: "Go to Leads"
  },
  {
    id: 3,
    title: "Set Up a Photography Project", 
    description: "Create your first project to organize sessions, track progress, and manage client deliverables.",
    route: "/projects",
    buttonText: "Create Project"
  },
  {
    id: 4,
    title: "Schedule a Photo Session",
    description: "Book your first session and learn how to manage your photography calendar efficiently.",
    route: "/calendar", 
    buttonText: "Schedule Session"
  },
  {
    id: 5,
    title: "Configure Your Packages",
    description: "Set up your photography packages and pricing to streamline your client booking process.",
    route: "/settings/services",
    buttonText: "Set Up Packages"
  }
];

const GettingStarted = () => {
  const { user } = useAuth();
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const [completedSteps] = useState<number[]>([]); // Will be managed by backend in next phase
  
  const currentStepIndex = completedSteps.length;
  const currentStep = onboardingSteps[currentStepIndex];
  const nextStep = onboardingSteps[currentStepIndex + 1];
  const progressPercentage = (completedSteps.length / onboardingSteps.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Custom Header for Guidance Mode */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Welcome to Lumiso! 🎉</h1>
              <p className="text-sm text-muted-foreground">Let's set up your photography business step by step</p>
            </div>
            <div className="flex items-center gap-3">
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Section */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Setup Progress
                {completedSteps.length > 0 && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </CardTitle>
              <CardDescription>
                {completedSteps.length}/5 Tasks Complete
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={progressPercentage} className="w-full" />
                <div className="flex flex-col sm:flex-row gap-2 text-sm text-muted-foreground">
                  <span className="font-medium">
                    Now: {currentStep ? currentStep.title : "All tasks complete! 🎉"}
                  </span>
                  {nextStep && (
                    <>
                      <span className="hidden sm:inline">→</span>
                      <span>Next: {nextStep.title}</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Task Display */}
        {currentStep && (
          <div className="mb-8">
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {currentStep.id}
                    </div>
                    Step {currentStep.id} of 5
                  </CardTitle>
                </div>
                <CardDescription className="text-lg font-medium text-foreground mt-2">
                  {currentStep.title}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-6">
                  {currentStep.description}
                </p>
                <Button size="lg" className="w-full sm:w-auto">
                  <Play className="w-4 h-4 mr-2" />
                  {currentStep.buttonText}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Completion State */}
        {!currentStep && (
          <div className="text-center">
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
              <CardContent className="py-12">
                <div className="mb-4">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                </div>
                <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                  Congratulations! 🎉
                </h2>
                <p className="text-green-600 dark:text-green-300 mb-6">
                  You've completed the guided setup! Your photography CRM is ready to use.
                </p>
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
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

      {/* Developer Override Button */}
      <RestartGuidedModeButton />
    </div>
  );
};

export default GettingStarted;