import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Save, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
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
      return t('pages:templateBuilder.nameDialog.validation.required');
    }

    if (trimmedName.length < 2) {
      return t('pages:templateBuilder.nameDialog.validation.minLength');
    }

    if (trimmedName.length > 100) {
      return t('pages:templateBuilder.nameDialog.validation.maxLength');
    }

    // Check for duplicates (case-insensitive)
    const isDuplicate = existingNames.some(
      existingName => existingName.toLowerCase() === trimmedName.toLowerCase() && 
                     existingName.toLowerCase() !== currentName.toLowerCase()
    );

    if (isDuplicate) {
      return t('pages:templateBuilder.nameDialog.validation.duplicate');
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
            {action === 'publish' ? t('pages:templateBuilder.nameDialog.titlePublish') : t('pages:templateBuilder.nameDialog.titleSave')}
          </DialogTitle>
          <DialogDescription>
            {action === 'publish' 
              ? t('pages:templateBuilder.nameDialog.descriptionPublish')
              : t('pages:templateBuilder.nameDialog.descriptionSave')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">{t('pages:templateBuilder.nameDialog.fields.name.label')}</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('pages:templateBuilder.nameDialog.fields.name.placeholder')}
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
            {t('pages:templateBuilder.nameDialog.buttons.cancel')}
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={loading || !name.trim()}
            className="min-w-[100px]"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                {action === 'publish' ? t('pages:templateBuilder.nameDialog.buttons.publishing') : t('pages:templateBuilder.nameDialog.buttons.saving')}
              </div>
            ) : (
              <>
                {action === 'publish' ? <Eye className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {action === 'publish' ? t('pages:templateBuilder.nameDialog.buttons.publish') : t('pages:templateBuilder.nameDialog.buttons.save')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}