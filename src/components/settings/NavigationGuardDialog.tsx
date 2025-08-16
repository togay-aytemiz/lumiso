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

interface NavigationGuardDialogProps {
  open: boolean;
  onDiscard: () => void;
  onStay: () => void;
  onSaveAndExit?: () => void;
  message?: string;
}

export function NavigationGuardDialog({ 
  open, 
  onDiscard, 
  onStay, 
  onSaveAndExit,
  message = "You have unsaved changes." 
}: NavigationGuardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
          <AlertDialogDescription>
            {message} Your changes will be lost if you continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onStay}>
            Stay
          </AlertDialogCancel>
          {onSaveAndExit && (
            <AlertDialogAction 
              onClick={onSaveAndExit}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save and Exit
            </AlertDialogAction>
          )}
          <AlertDialogAction 
            onClick={onDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}