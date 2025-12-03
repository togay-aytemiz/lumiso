import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { VariablePicker } from '@/components/template-builder/VariablePicker';
import { useTranslation } from 'react-i18next';

interface InlinePreheaderEditorProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}

export function InlinePreheaderEditor({
  value,
  onSave,
  onCancel,
  placeholder
}: InlinePreheaderEditorProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation("pages");
  const [isVariablePickerOpen, setIsVariablePickerOpen] = useState(false);
  const interactionRef = useRef(false);
  const resolvedPlaceholder = placeholder ?? t("templateBuilder.preview.excitedMessage", {
    defaultValue: "We're excited to capture your special moments"
  });

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

  const handleBlur = () => {
    if (interactionRef.current || isVariablePickerOpen) {
      return;
    }

    if (inputValue.trim() !== (value || '').trim()) {
      handleSave();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const insertVariable = (variable: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? inputValue.length;
      const end = input.selectionEnd ?? inputValue.length;
      const newValue = inputValue.slice(0, start) + variable + inputValue.slice(end);
      setInputValue(newValue);

      // Set cursor position after the inserted variable and reset scroll
      setTimeout(() => {
        input.focus();
        const newCursorPosition = start + variable.length;
        input.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    } else {
      setInputValue(inputValue + variable);
    }
  };

  const markInteraction = () => {
    interactionRef.current = true;
  };

  const clearInteraction = () => {
    interactionRef.current = false;
  };
  const variableLabel = t("templateBuilder.inlineActions.variable", { defaultValue: "Değişken Ekle" });
  const saveLabel = t("templateBuilder.inlineActions.save", { defaultValue: "Kaydet" });
  const cancelLabel = t("templateBuilder.inlineActions.cancel", { defaultValue: "Vazgeç" });

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={resolvedPlaceholder}
          className="relative z-10 h-8 w-full text-sm"
          disabled={isSaving}
        />
      </div>
      <VariablePicker
        onVariableSelect={insertVariable}
        onOpenChange={(open) => {
          setIsVariablePickerOpen(open);
          interactionRef.current = open;
          if (!open) {
            requestAnimationFrame(() => {
              clearInteraction();
              inputRef.current?.focus();
            });
          }
        }}
        trigger={
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-3 gap-2 bg-muted text-foreground border border-border hover:bg-muted/80"
            onMouseDown={markInteraction}
          >
            <span className="text-xs font-mono">{"{…}"}</span>
            <span className="text-xs">{variableLabel}</span>
          </Button>
        }
      />
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          disabled={isSaving}
          className="h-8 px-3 gap-2 bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100/80"
        >
          <Check className="h-3 w-3" />
          <span className="text-xs">{saveLabel}</span>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onCancel}
          disabled={isSaving}
          className="h-8 px-3 gap-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
        >
          <X className="h-3 w-3" />
          <span className="text-xs">{cancelLabel}</span>
        </Button>
      </div>
    </div>
  );
}
