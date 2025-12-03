import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { emojis } from "@/lib/templateUtils";
import { useTranslation } from "react-i18next";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export function EmojiPicker({ onEmojiSelect, trigger, onOpenChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("pages");
  const tooltipLabel = t("templateBuilder.emojiPicker.tooltip", { defaultValue: "Insert emoji" });

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setOpen(false);
  };

  const TriggerNode = trigger || (
    <Button variant="outline" size="sm" className="h-8 px-2" aria-label={tooltipLabel}>
      <Smile className="h-3 w-3" />
    </Button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange?.(next);
      }}
    >
      <PopoverTrigger asChild>{TriggerNode}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" side="bottom" align="end">
        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
          {emojis.map((emoji, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="text-lg hover:bg-muted p-2 rounded text-center transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
