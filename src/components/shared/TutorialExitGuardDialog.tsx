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
  currentStepTitle?: string;
}

export function TutorialExitGuardDialog({ 
  open, 
  onStay, 
  onReturnToGettingStarted, 
  currentStepTitle 
}: TutorialExitGuardDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit Tutorial?</AlertDialogTitle>
          <AlertDialogDescription>
            You'll return to the Getting Started page without completing this step. You can continue the tutorial later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onStay}>
            Stay
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onReturnToGettingStarted}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Return to Getting Started
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}