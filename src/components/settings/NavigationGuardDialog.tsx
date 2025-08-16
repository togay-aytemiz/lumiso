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
  message?: string;
}

export function NavigationGuardDialog({ 
  open, 
  onDiscard, 
  onStay, 
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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>
            Stay and Save
          </AlertDialogCancel>
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