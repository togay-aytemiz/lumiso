import { useState } from "react";
import { Settings, RotateCcw, Play, ChevronRight, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";

export function DeveloperSettings() {
  const { user } = useAuth();
  const { steps, currentStep, completedSteps, resetGuidedSetup, jumpToStep, skipWithSampleData } = useOnboarding();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Only show for the specific developer user
  if (!user || user.email !== "togayaytemiz@gmail.com") {
    return null;
  }

  const handleResetGuidedSetup = async () => {
    setIsLoading(true);
    try {
      await resetGuidedSetup();
      toast({
        title: "Guided setup reset",
        description: "All steps have been cleared and setup restarted.",
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset guided setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitGuidanceMode = async () => {
    setIsLoading(true);
    try {
      await skipWithSampleData();
      toast({
        title: "Guidance mode exited",
        description: "You now have access to all features.",
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to exit guidance mode. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJumpToStep = async (stepNumber: number) => {
    setIsLoading(true);
    try {
      await jumpToStep(stepNumber);
      toast({
        title: "Jumped to step",
        description: `Now on step ${stepNumber}: ${steps.find(s => s.id === stepNumber)?.title}`,
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to jump to step. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full bg-background/95 backdrop-blur-sm border-2 border-primary/20 hover:border-primary/40 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent 
          side="top" 
          align="end"
          className="w-80 p-4 bg-background/95 backdrop-blur-sm border border-border/50"
          sideOffset={8}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Developer Settings</h3>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Current Step: {currentStep} / {steps.length}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-foreground">Jump to Step:</h4>
                <div className="grid grid-cols-1 gap-1">
                  {steps.map((step) => (
                    <Button
                      key={step.id}
                      variant={currentStep === step.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => handleJumpToStep(step.id)}
                      disabled={isLoading}
                      className="justify-start h-auto p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          completedSteps.includes(step.id) 
                            ? 'bg-primary border-primary text-primary-foreground' 
                            : currentStep === step.id
                              ? 'border-primary text-primary'
                              : 'border-muted-foreground/30 text-muted-foreground'
                        }`}>
                          {completedSteps.includes(step.id) ? (
                            <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                          ) : (
                            <span className="text-[10px] font-medium">{step.id}</span>
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-[11px] leading-tight">{step.title}</div>
                        </div>
                        {currentStep === step.id && <ChevronRight className="h-3 w-3" />}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetGuidedSetup}
                  disabled={isLoading}
                  className="w-full text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-2" />
                  Reset Guided Setup
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExitGuidanceMode}
                  disabled={isLoading}
                  className="w-full text-xs text-orange-600 hover:text-orange-700 border-orange-200 hover:border-orange-300"
                >
                  <LogOut className="h-3 w-3 mr-2" />
                  Exit Guidance Mode
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}