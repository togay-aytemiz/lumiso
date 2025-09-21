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
import { useFormsTranslation } from '@/hooks/useTypedTranslation';

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
  const { t } = useFormsTranslation();
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('tutorial.exitTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('tutorial.exitMessage')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onStay}>
            {t('tutorial.stay')}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onReturnToGettingStarted}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isProcessing}
            aria-disabled={isProcessing}
          >
            {t('tutorial.returnToGettingStarted')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}