import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface FieldTextDisplayProps {
  value: string;
  maxLines?: number;
  allowTruncation?: boolean;
}

export function FieldTextDisplay({ 
  value, 
  maxLines = 3, 
  allowTruncation = true 
}: FieldTextDisplayProps) {
  const { t } = useTranslation("common");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!allowTruncation) {
      setIsTruncatable(false);
      return;
    }
    
    if (!textRef.current || !value) {
      setIsTruncatable(false);
      return;
    }

    const el = textRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      setIsTruncatable(el.scrollHeight > el.clientHeight + 1);
    });
  }, [value, isExpanded, allowTruncation]);

  if (!value) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  const maxHeight = `${maxLines * 1.5}rem`; // Assuming 1.5rem line height

  return (
    <div className="space-y-1">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              ref={textRef}
              className={cn(
                "text-sm transition-all break-words whitespace-pre-wrap",
                allowTruncation && !isExpanded && "overflow-hidden"
              )}
              style={{
                maxHeight: allowTruncation && !isExpanded ? maxHeight : undefined
              }}
            >
              {value}
            </div>
          </TooltipTrigger>
          {allowTruncation && isTruncatable && !isExpanded && (
            <TooltipContent className="max-w-xs">
              {value}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      
      {allowTruncation && (isTruncatable || isExpanded) && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setIsExpanded(prev => !prev);
                }}
              >
                {isExpanded ? t("showLess") : t("showMore")}
              </button>
      )}
    </div>
  );
}
