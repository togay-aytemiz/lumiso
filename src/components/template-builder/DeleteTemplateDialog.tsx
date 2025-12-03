import { useMessagesTranslation } from '@/hooks/useTypedTranslation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  templateName: string;
  loading?: boolean;
}

export function DeleteTemplateDialog({
  open,
  onClose,
  onConfirm,
  templateName,
  loading = false
}: DeleteTemplateDialogProps) {
  const { t: tMessages } = useMessagesTranslation();
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {tMessages('templateDeleteDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {tMessages('confirm.deleteTemplate')} {tMessages('confirm.cannotUndo')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {tMessages('templateDeleteDialog.workflowWarning')}
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong className="font-semibold">"{templateName}"</strong> {tMessages('templateDeleteDialog.deleteWarning')}
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            {tMessages('templateDeleteDialog.willRemove')}
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>{tMessages('templateDeleteDialog.removeDesign')}</li>
              <li>{tMessages('templateDeleteDialog.removeBlocks')}</li>
              <li>{tMessages('templateDeleteDialog.removeSubject')}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            {tMessages('templateDeleteDialog.cancel')}
          </Button>
          <Button 
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="min-w-[100px]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                {tMessages('templateDeleteDialog.deleting')}
              </div>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {tMessages('templateDeleteDialog.delete')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
