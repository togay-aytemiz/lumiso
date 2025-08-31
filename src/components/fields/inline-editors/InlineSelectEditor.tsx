import { useState, useRef, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface InlineSelectEditorProps {
  value: string | null;
  options: string[];
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  showButtons?: boolean;
}

export function InlineSelectEditor({
  value,
  options,
  onSave,
  onCancel,
  placeholder = "Select option",
  showButtons = false
}: InlineSelectEditorProps) {
  const [selectedValue, setSelectedValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [originalValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(true);

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      await onSave(selectedValue);
    } finally {
      setIsSaving(false);
    }
  };

  const handleValueChange = (newValue: string) => {
    setSelectedValue(newValue);
    setIsOpen(false);
    // Auto-save on selection when not showing buttons
    if (!showButtons) {
      setTimeout(() => handleSave(), 100);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Select
        value={selectedValue}
        onValueChange={handleValueChange}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger className="h-7 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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