import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FieldTextareaDisplayProps {
  value: string;
  maxLines?: number;
}

export function FieldTextareaDisplay({ 
  value, 
  maxLines = 2 
}: FieldTextareaDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTruncatable, setIsTruncatable] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textRef.current || !value) {
      setIsTruncatable(false);
      return;
    }

    const el = textRef.current;
    requestAnimationFrame(() => {
      if (!el) return;
      setIsTruncatable(el.scrollHeight > el.clientHeight + 1);
    });
  }, [value, isExpanded]);

  if (!value) {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }

  const maxHeight = `${maxLines * 1.5}rem`; // Assuming 1.5rem line height

  return (
    <div className="space-y-2">
      <div
        ref={textRef}
        className={cn(
          "whitespace-pre-wrap text-sm transition-all break-words text-left",
          !isExpanded && "overflow-hidden"
        )}
        style={{
          maxHeight: !isExpanded ? maxHeight : undefined
        }}
      >
        {value}
      </div>
      
      {(isTruncatable || isExpanded) && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors inline"
          onClick={(e) => { 
            e.stopPropagation(); 
            setIsExpanded(prev => !prev);
          }}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}