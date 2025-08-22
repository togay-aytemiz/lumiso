import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface FieldTextareaTableDisplayProps {
  value: string;
}

export function FieldTextareaTableDisplay({ value }: FieldTextareaTableDisplayProps) {
  const isMobile = useIsMobile();

  if (!value) {
    return <span className="text-muted-foreground italic">-</span>;
  }

  // Convert line breaks to single line with separator and check if truncation is needed
  const singleLineValue = value.replace(/\n+/g, ' • ');
  const needsTruncation = singleLineValue.length > 50;

  return (
    <TooltipProvider delayDuration={isMobile ? 0 : 300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "text-sm transition-colors cursor-default",
              needsTruncation && "truncate max-w-[200px]"
            )}
          >
            {singleLineValue}
          </div>
        </TooltipTrigger>
        {needsTruncation && (
          <TooltipContent 
            className="max-w-md break-words whitespace-pre-wrap"
            side={isMobile ? "top" : "right"}
          >
            {value}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}