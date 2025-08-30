import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { EmojiPicker } from '@/components/template-builder/EmojiPicker';
import { VariablePicker } from '@/components/template-builder/VariablePicker';
import { getCharacterCount, checkSpamWords } from '@/lib/templateUtils';

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
  placeholder = "Your photography session is confirmed!"
}: InlineSubjectEditorProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
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

  const charCount = getCharacterCount(inputValue);
  const spamWords = checkSpamWords(inputValue);

  return (
    <div className="space-y-2">
      {/* Input row */}
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 h-8 text-sm"
          disabled={isSaving}
        />
        <EmojiPicker onEmojiSelect={insertEmoji} />
        <VariablePicker 
          onVariableSelect={insertVariable}
          trigger={
            <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
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
      </div>

      {/* Validation row */}
      {(charCount > 60 || spamWords.length > 0) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {charCount > 60 && (
            <div className="flex items-center gap-1">
              <span className="text-amber-600">⚠️</span>
              <span className="text-amber-600">
                {charCount}/60 characters (too long)
              </span>
            </div>
          )}
          {spamWords.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-amber-600">⚠️</span>
              <span>Spam words:</span>
              <div className="flex gap-1">
                {spamWords.slice(0, 2).map(word => (
                  <Badge key={word} variant="secondary" className="text-xs px-1 py-0">
                    {word}
                  </Badge>
                ))}
                {spamWords.length > 2 && (
                  <span className="text-amber-600">+{spamWords.length - 2} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}