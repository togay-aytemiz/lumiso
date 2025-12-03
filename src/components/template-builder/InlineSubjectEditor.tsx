import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Smile, X } from 'lucide-react';
import { EmojiPicker } from '@/components/template-builder/EmojiPicker';
import { VariablePicker } from '@/components/template-builder/VariablePicker';
import { getCharacterCount, checkSpamWords } from '@/lib/templateUtils';
import { useTranslation } from 'react-i18next';

interface InlineSubjectEditorProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
}

export function InlineSubjectEditor({
  value,
  onSave,
  onCancel,
  placeholder
}: InlineSubjectEditorProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation("pages");
  const [isVariablePickerOpen, setIsVariablePickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const interactionRef = useRef(false);
  const resolvedPlaceholder = placeholder ?? t("templateBuilder.preview.defaultSubject", {
    defaultValue: "Your photography session is confirmed!"
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
    if (interactionRef.current || isVariablePickerOpen || isEmojiPickerOpen) {
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

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? inputValue.length;
      const end = input.selectionEnd ?? inputValue.length;
      const newValue = inputValue.slice(0, start) + emoji + inputValue.slice(end);
      setInputValue(newValue);

      // Set cursor position after the inserted emoji and reset scroll
      setTimeout(() => {
        input.focus();
        const newCursorPosition = start + emoji.length;
        input.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    } else {
      setInputValue(inputValue + emoji);
    }
  };

  const markInteraction = () => {
    interactionRef.current = true;
  };

  const clearInteraction = () => {
    interactionRef.current = false;
  };

  const charCount = getCharacterCount(inputValue);
  const spamWords = checkSpamWords(inputValue);
  const emojiLabel = t("templateBuilder.inlineActions.emoji", { defaultValue: "Emoji Ekle" });
  const variableLabel = t("templateBuilder.inlineActions.variable", { defaultValue: "Değişken Ekle" });
  const saveLabel = t("templateBuilder.inlineActions.save", { defaultValue: "Kaydet" });
  const cancelLabel = t("templateBuilder.inlineActions.cancel", { defaultValue: "Vazgeç" });

  return (
    <div className="space-y-1">
      {/* Input row */}
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
        <EmojiPicker
          onEmojiSelect={insertEmoji}
          onOpenChange={(open) => {
            setIsEmojiPickerOpen(open);
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
              <Smile className="h-3 w-3" />
              <span className="text-xs">{emojiLabel}</span>
            </Button>
          }
        />
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

      {/* Validation row */}
      {(charCount > 60 || spamWords.length > 0) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-16">
          {charCount > 60 && (
            <div className="flex items-center gap-1">
              <span className="text-amber-600">⚠️</span>
              <span className="text-amber-600">
                {t("templateBuilder.warnings.tooLong", { count: charCount })}
              </span>
            </div>
          )}
          {spamWords.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-amber-600">⚠️</span>
              <span>{t("templateBuilder.warnings.spamWords")}</span>
              <div className="flex gap-1">
                {spamWords.slice(0, 2).map(word => (
                  <Badge key={word} variant="secondary" className="text-xs px-1 py-0">
                    {word}
                  </Badge>
                ))}
                {spamWords.length > 2 && (
                  <span className="text-amber-600">
                    {t("templateBuilder.warnings.moreSpamWords", { count: spamWords.length - 2 })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
