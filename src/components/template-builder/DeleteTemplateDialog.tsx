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
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Template
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this template? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>"{templateName}"</strong> will be permanently deleted and cannot be recovered.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-muted-foreground">
            This will remove:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>The template design and content</li>
              <li>All associated blocks and styling</li>
              <li>Subject and preheader text</li>
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
            Cancel
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
                Deleting...
              </div>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}