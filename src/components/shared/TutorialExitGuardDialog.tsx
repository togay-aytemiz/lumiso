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
  onOpenChange?: (open: boolean) => void;
  isProcessing?: boolean;
}

export function TutorialExitGuardDialog({ 
  open, 
  onStay, 
  onReturnToGettingStarted, 
  currentStepTitle,
  onOpenChange,
  isProcessing
}: TutorialExitGuardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            disabled={isProcessing}
            aria-disabled={isProcessing}
          >
            Return to Getting Started
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}