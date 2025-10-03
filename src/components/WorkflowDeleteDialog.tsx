import { useMessagesTranslation } from '@/hooks/useTypedTranslation';
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
import { Workflow } from "@/types/workflow";
import { AlertTriangle } from "lucide-react";

interface WorkflowDeleteDialogProps {
  open: boolean;
  workflow: Workflow | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function WorkflowDeleteDialog({ 
  open, 
  workflow, 
  onConfirm, 
  onCancel,
  isDeleting = false
}: WorkflowDeleteDialogProps) {
  const { t: tMessages } = useMessagesTranslation();
  
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
              <AlertDialogDescription>
                {tMessages('confirm.deleteWithName', { name: workflow?.name })}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        
        <div className="py-4">
          <AlertDialogDescription className="text-base">
            This action cannot be undone. The workflow and all its automation steps will be permanently removed.
          </AlertDialogDescription>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Workflow"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}