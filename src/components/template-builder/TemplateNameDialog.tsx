import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Save, Eye } from 'lucide-react';

interface TemplateNameDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  currentName: string;
  existingNames: string[];
  action: 'save' | 'publish';
  loading?: boolean;
}

export function TemplateNameDialog({
  open,
  onClose,
  onConfirm,
  currentName,
  existingNames,
  action,
  loading = false
}: TemplateNameDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      // Start with current name if it's not "Untitled Template"
      const isUntitled = currentName === 'Untitled Template' || 
                        currentName.toLowerCase().includes('untitled') ||
                        currentName.trim() === '';
      setName(isUntitled ? '' : currentName);
      setError('');
    }
  }, [open, currentName]);

  const validateName = (inputName: string) => {
    const trimmedName = inputName.trim();
    
    if (!trimmedName) {
      return 'Template name is required';
    }

    if (trimmedName.length < 2) {
      return 'Template name must be at least 2 characters long';
    }

    if (trimmedName.length > 100) {
      return 'Template name must be less than 100 characters';
    }

    // Check for duplicates (case-insensitive)
    const isDuplicate = existingNames.some(
      existingName => existingName.toLowerCase() === trimmedName.toLowerCase() && 
                     existingName.toLowerCase() !== currentName.toLowerCase()
    );

    if (isDuplicate) {
      return 'A template with this name already exists. Please choose a different name.';
    }

    return '';
  };

  const handleInputChange = (value: string) => {
    setName(value);
    if (error) {
      setError('');
    }
  };

  const handleConfirm = () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    onConfirm(name.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'publish' ? <Eye className="h-5 w-5" /> : <Save className="h-5 w-5" />}
            {action === 'publish' ? 'Publish Template' : 'Save Template'}
          </DialogTitle>
          <DialogDescription>
            {action === 'publish' 
              ? 'Please provide a name for your template before publishing.' 
              : 'Please provide a name for your template before saving.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter template name..."
              className={error ? 'border-red-500' : ''}
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={loading || !name.trim()}
            className="min-w-[100px]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                {action === 'publish' ? 'Publishing...' : 'Saving...'}
              </div>
            ) : (
              <>
                {action === 'publish' ? <Eye className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {action === 'publish' ? 'Publish' : 'Save'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}