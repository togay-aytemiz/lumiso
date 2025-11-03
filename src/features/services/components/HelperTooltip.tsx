import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface HelperTooltipProps {
  label: string;
  content: string;
}

export const HelperTooltip = ({ label, content }: HelperTooltipProps) => (
  <TooltipProvider delayDuration={150} disableHoverableContent>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground transition-colors hover:text-slate-900"
          aria-label={label}
        >
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-snug">{content}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

