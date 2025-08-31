import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Mail } from 'lucide-react';

interface InlineEmailEditorProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  showButtons?: boolean;
}

export function InlineEmailEditor({
  value,
  onSave,
  onCancel,
  showButtons = false
}: InlineEmailEditorProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [originalValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(inputValue.trim());
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = async () => {
    if (!showButtons && inputValue.trim() !== originalValue.trim()) {
      await handleSave();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Enter email address"
          className="h-7 text-sm pr-8"
          disabled={isSaving}
        />
        <Mail className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
      </div>
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