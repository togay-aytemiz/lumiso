import { useState, useEffect } from "react";
import { Check, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface InlineMultiSelectEditorProps {
  value: string | null;
  options: string[];
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
  placeholder?: string;
  showButtons?: boolean;
}

export function InlineMultiSelectEditor({
  value,
  options,
  onSave,
  onCancel,
  placeholder = "Select options",
  showButtons = true,
}: InlineMultiSelectEditorProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>(
    value
      ? value
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [originalValue] = useState(value || "");

  useEffect(() => {
    setSelectedValues(
      value
        ? value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : []
    );
  }, [value]);

  const handleToggleOption = (option: string) => {
    setSelectedValues((prev) => {
      if (prev.includes(option)) {
        return prev.filter((v) => v !== option);
      } else {
        return [...prev, option];
      }
    });
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      const valueToSave = selectedValues.join(", ");
      await onSave(valueToSave);
    } catch (error) {
      console.error("Failed to save multi-select field:", error);
      setSelectedValues(
        originalValue
          ? originalValue
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : []
      );
    } finally {
      setIsSaving(false);
    }
  };

  const displayText =
    selectedValues.length > 0
      ? `${selectedValues.length} selected`
      : placeholder;

  return (
    <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="h-7 text-sm justify-between w-full max-w-xs"
          >
            <span className="truncate">{displayText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-3 z-50 bg-background"
          align="start"
        >
          <div className="space-y-2">
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-1 pb-2 border-b">
                {selectedValues.map((val) => (
                  <Badge key={val} variant="secondary" className="text-xs">
                    {val}
                  </Badge>
                ))}
              </div>
            )}
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {options.map((option) => (
                <div
                  key={option}
                  className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                  onClick={() => handleToggleOption(option)}
                >
                  <Checkbox
                    checked={selectedValues.includes(option)}
                    onCheckedChange={() => handleToggleOption(option)}
                  />
                  <label className="text-sm flex-1 cursor-pointer">
                    {option}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

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
