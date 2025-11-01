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
import { useTranslation } from "react-i18next";

interface NavigationGuardDialogProps {
  open: boolean;
  onDiscard: () => void;
  onStay: () => void;
  onSaveAndExit?: () => void;
  message?: string;
  stayLabel?: string;
}

export function NavigationGuardDialog({ 
  open, 
  onDiscard, 
  onStay, 
  onSaveAndExit,
  message,
  stayLabel,
}: NavigationGuardDialogProps) {
  const { t } = useTranslation('forms');
  
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('navigationGuard.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {message || t('navigationGuard.message')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onStay}>
            {stayLabel ?? t('navigationGuard.stay')}
          </AlertDialogCancel>
          {onSaveAndExit && (
            <AlertDialogAction 
              onClick={onSaveAndExit}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('navigationGuard.saveAndExit')}
            </AlertDialogAction>
          )}
          <AlertDialogAction 
            onClick={onDiscard}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('navigationGuard.discardChanges')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
