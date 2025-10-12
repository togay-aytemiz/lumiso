import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface InlineNumberEditorProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  min?: number;
  max?: number;
  showButtons?: boolean;
}

export function InlineNumberEditor({
  value,
  onSave,
  onCancel,
  placeholder = "Enter number",
  min,
  max,
  showButtons = false
}: InlineNumberEditorProps) {
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
    } catch (error) {
      console.error('Failed to save number field:', error);
      setInputValue(originalValue);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string, numbers, and decimal points
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setInputValue(value);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="h-7 text-sm"
        disabled={isSaving}
        min={min}
        max={max}
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