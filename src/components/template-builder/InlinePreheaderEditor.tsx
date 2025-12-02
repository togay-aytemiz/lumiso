import { useState, useRef, useEffect } from 'react';
import type { UIEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { VariablePicker } from '@/components/template-builder/VariablePicker';
import { useVariableLabelMap } from '@/hooks/useVariableLabelMap';
import { VariableTokenText } from './VariableTokenText';
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const variableLabels = useVariableLabelMap();
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
        // Reset scroll to prevent cursor from appearing far to the right
        input.scrollLeft = 0;
        setScrollLeft(0);
      }, 0);
    } else {
      setInputValue(inputValue + variable);
    }
  };

  const handleInputScroll = (event: UIEvent<HTMLInputElement>) => {
    setScrollLeft(event.currentTarget.scrollLeft);
  };

  const markInteraction = () => {
    interactionRef.current = true;
  };

  const clearInteraction = () => {
    interactionRef.current = false;
  };

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
          className="relative z-10 h-8 w-full text-sm bg-transparent text-transparent caret-foreground placeholder:text-transparent"
          disabled={isSaving}
          onScroll={handleInputScroll}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex items-center overflow-hidden px-3 text-sm text-foreground whitespace-pre"
        >
          <div
            className="w-full"
            style={{ transform: `translateX(${-scrollLeft}px)` }}
          >
            <VariableTokenText
              text={inputValue}
              placeholder={resolvedPlaceholder}
              variableLabels={variableLabels}
            />
            <span className="opacity-0">.</span>
          </div>
        </div>
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
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onMouseDown={markInteraction}
          >
            {"{…}"}
          </Button>
        }
      />
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={isSaving}
          className="h-6 w-6 p-0 bg-muted hover:bg-muted/80 border border-border rounded-md shadow-sm"
        >
          <Check className="h-3 w-3 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
          className="h-6 w-6 p-0 bg-muted hover:bg-muted/80 border border-border rounded-md shadow-sm"
        >
          <X className="h-3 w-3 text-red-600" />
        </Button>
      </div>
    </div>
  );
}
