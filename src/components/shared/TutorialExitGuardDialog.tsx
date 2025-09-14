import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TutorialExitGuardDialogProps {
  open: boolean;
  onStay: () => void;
  onReturnToGettingStarted: () => void;
  onSkipSetup: () => void;
  currentStepTitle?: string;
}

export function TutorialExitGuardDialog({ 
  open, 
  onStay, 
  onReturnToGettingStarted, 
  onSkipSetup,
  currentStepTitle 
}: TutorialExitGuardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit Tutorial?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              You'll return to the Getting Started page and won't complete 
              {currentStepTitle ? ` the "${currentStepTitle}"` : " this"} step.
            </p>
            <p>
              You can continue the tutorial later or skip the setup entirely and start using the app.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onStay}>
            Stay in Tutorial
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onReturnToGettingStarted}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            Return to Getting Started
          </AlertDialogAction>
          <AlertDialogAction 
            onClick={onSkipSetup}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Skip Setup Completely
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}