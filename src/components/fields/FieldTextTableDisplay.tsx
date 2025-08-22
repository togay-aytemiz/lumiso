import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface FieldTextTableDisplayProps {
  value: string;
}

export function FieldTextTableDisplay({ value }: FieldTextTableDisplayProps) {
  const isMobile = useIsMobile();

  if (!value) {
    return <span className="text-muted-foreground italic">-</span>;
  }

  // Check if text needs truncation (roughly more than 50 characters)
  const needsTruncation = value.length > 50;

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
            {value}
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