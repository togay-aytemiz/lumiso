import { useState, useRef, useEffect } from 'react';
import type { UIEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Smile, X } from 'lucide-react';
import { EmojiPicker } from '@/components/template-builder/EmojiPicker';
import { VariablePicker } from '@/components/template-builder/VariablePicker';
import { getCharacterCount, checkSpamWords } from '@/lib/templateUtils';
import { useVariableLabelMap } from '@/hooks/useVariableLabelMap';
import { VariableTokenText } from './VariableTokenText';
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const variableLabels = useVariableLabelMap();
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
    const newValue = inputValue + variable;
    setInputValue(newValue);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const insertEmoji = (emoji: string) => {
    const newValue = inputValue + emoji;
    setInputValue(newValue);
    if (inputRef.current) {
      inputRef.current.focus();
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

  const charCount = getCharacterCount(inputValue);
  const spamWords = checkSpamWords(inputValue);

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
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onMouseDown={markInteraction}
            >
              <Smile className="h-3 w-3" />
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
