import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LongPressButton } from "@/components/ui/long-press-button";

interface TutorialFloatingCardProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  content?: React.ReactNode;
  canProceed: boolean;
  requiresAction?: boolean;
  disabledTooltip?: string;
  onNext: () => void;
  onExit: () => void;
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left" | "center";
}

export function TutorialFloatingCard({
  stepNumber,
  totalSteps,
  title,
  description,
  content,
  canProceed,
  requiresAction,
  disabledTooltip,
  onNext,
  onExit,
  position = "top-right"
}: TutorialFloatingCardProps) {
  const getPositionClasses = () => {
    switch (position) {
      case "top-right":
        return "fixed top-4 right-4 z-50";
      case "bottom-right":
        return "fixed bottom-4 right-4 z-50";
      case "top-left":
        return "fixed top-4 left-4 z-50";
      case "bottom-left":
        return "fixed bottom-4 left-4 z-50";
      case "center":
        return "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50";
      default:
        return "fixed top-4 right-4 z-50";
    }
  };

  const isLastStep = stepNumber === totalSteps;

  return (
    <div className={getPositionClasses()}>
      <Card className="w-80 max-w-[90vw] shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-medium">
              Step {stepNumber} of {totalSteps}
            </div>
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
          
          {content && (
            <div className="text-sm">
              {content}
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <LongPressButton
              variant="dangerOutline"
              onConfirm={onExit}
              label="Exit Tutorial"
              duration={3000}
              holdingLabel="Hold to exit…"
              completeLabel="Exiting…"
              className="flex-1"
            />
            
            {requiresAction && !canProceed ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button disabled className="flex-1">
                      {isLastStep ? "Complete" : "Next"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{disabledTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button onClick={onNext} className="flex-1">
                {isLastStep ? "Complete" : "Next"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}