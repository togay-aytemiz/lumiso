import { useState } from "react";
import { Type, GripVertical, Eye, EyeOff, Trash2, Variable } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VariableAutocomplete } from "../VariableAutocomplete";
import type { Block } from "@/pages/TemplateBuilder";

interface TextBlockEditorProps {
  block: Block;
  onUpdate: (updates: Partial<Block>) => void;
  onRemove: () => void;
}

export function TextBlockEditor({ block, onUpdate, onRemove }: TextBlockEditorProps) {
  const [showVariables, setShowVariables] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleTextChange = (text: string) => {
    onUpdate({
      content: { ...block.content, text }
    });
  };

  const insertVariable = (variable: string, textareaRef: HTMLTextAreaElement) => {
    const text = block.content.text || '';
    const beforeCursor = text.substring(0, textareaRef.selectionStart);
    const afterCursor = text.substring(textareaRef.selectionEnd);
    const newText = beforeCursor + `{${variable}}` + afterCursor;
    
    handleTextChange(newText);
    
    // Set cursor position after the inserted variable
    setTimeout(() => {
      const newPosition = beforeCursor.length + variable.length + 2;
      textareaRef.setSelectionRange(newPosition, newPosition);
      textareaRef.focus();
    }, 0);
  };

  return (
    <Card className={`${!block.isVisible ? 'opacity-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="cursor-grab">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="p-1.5 rounded bg-primary/10">
              <Type className="h-3 w-3 text-primary" />
            </div>
            <span className="font-medium text-sm">Text Block</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVariables(!showVariables)}
              className="h-7 px-2"
            >
              <Variable className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate({ isVisible: !block.isVisible })}
              className="h-7 px-2"
            >
              {block.isVisible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-7 px-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="relative">
          <Textarea
            value={block.content.text || ''}
            onChange={(e) => handleTextChange(e.target.value)}
            onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart)}
            placeholder="Enter your text here... Use {customer_name}, {session_date}, etc."
            className="min-h-[100px] resize-none"
            id={`text-${block.id}`}
          />
          
          {showVariables && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1">
              <VariableAutocomplete
                onVariableSelect={(variable) => {
                  const textarea = document.getElementById(`text-${block.id}`) as HTMLTextAreaElement;
                  if (textarea) {
                    insertVariable(variable, textarea);
                  }
                }}
                className="bg-card border shadow-lg"
              />
            </div>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          Supports rich formatting, emojis, and variables. Use bold **text** or *italic*
        </div>
      </CardContent>
    </Card>
  );
}