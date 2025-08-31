import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface InlineCheckboxEditorProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  showButtons?: boolean;
}

export function InlineCheckboxEditor({
  value,
  onSave,
  onCancel,
  showButtons = false
}: InlineCheckboxEditorProps) {
  const [checked, setChecked] = useState(value === 'true' || value === '1');
  const [isSaving, setIsSaving] = useState(false);
  const [originalValue] = useState(value === 'true' || value === '1');

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(checked.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckChange = (newChecked: boolean) => {
    setChecked(newChecked);
    // Auto-save on change when not showing buttons
    if (!showButtons) {
      setTimeout(async () => {
        if (!isSaving) {
          setIsSaving(true);
          try {
            await onSave(newChecked.toString());
          } finally {
            setIsSaving(false);
          }
        }
      }, 100);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={handleCheckChange}
        disabled={isSaving}
      />
      {showButtons && (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-6 w-6 p-0 bg-gray-100 hover:bg-gray-200 border border-border rounded-md shadow-sm"
          >
            <Check className="h-3 w-3 text-green-600" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={isSaving}
            className="h-6 w-6 p-0 bg-gray-100 hover:bg-gray-200 border border-border rounded-md shadow-sm"
          >
            <X className="h-3 w-3 text-red-600" />
          </Button>
        </div>
      )}
    </div>
  );
}