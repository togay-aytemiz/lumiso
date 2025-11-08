import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

export interface ProjectServicesCardItem {
  key: string;
  left: ReactNode;
  right?: ReactNode;
}

interface ProjectServicesCardProps {
  items: ProjectServicesCardItem[];
  emptyCtaLabel: string;
  onAdd: () => void;
  title: string;
  helperText?: string;
  tooltipAriaLabel: string;
  tooltipContent: ReactNode;
  addButtonLabel: string;
  itemAlign?: "start" | "center";
  itemRightAlign?: "start" | "end";
}

export function ProjectServicesCard({
  items,
  emptyCtaLabel,
  onAdd,
  title,
  helperText,
  tooltipAriaLabel,
  tooltipContent,
  addButtonLabel,
  itemAlign = "center",
  itemRightAlign = "end"
}: ProjectServicesCardProps) {
  const hasItems = items.length > 0;
  const alignmentClass = itemAlign === "start" ? "items-start" : "items-center";
  const paddingClass = hasItems ? "px-4 py-3" : "px-3 py-2";
  const headerGapClass = hasItems ? "gap-1.5" : "gap-1";
  const rightAlignmentClass = itemRightAlign === "start" ? "shrink-0" : "shrink-0 text-right";
  const iconButtonClass =
    "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/70 focus:outline-none focus:ring-1 focus:ring-muted-foreground/40";

  return (
    <div className={`rounded-xl border ${paddingClass}`}>
      <div className={`flex items-start justify-between ${headerGapClass}`}>
        {hasItems ? (
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {helperText ? (
              <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
            ) : null}
          </div>
        ) : (
          <Button
            variant="link"
            className="h-auto px-0 text-left text-sm font-semibold"
            onClick={onAdd}
          >
            {emptyCtaLabel}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className={iconButtonClass} aria-label={tooltipAriaLabel}>
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-2 text-sm leading-relaxed">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </div>
      {hasItems ? (
        <>
          <div className="mt-3 h-px w-full bg-border" role="separator" aria-hidden="true" />
          <div className="mt-2 space-y-1.5">
            {items.map(({ key, left, right }) => (
              <div
                key={key}
                className={`flex ${alignmentClass} justify-between gap-3 text-sm`}
              >
                <div className="min-w-0">{left}</div>
                {right ? <div className={rightAlignmentClass}>{right}</div> : null}
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="link" className="h-auto px-0 text-sm font-semibold" onClick={onAdd}>
              {addButtonLabel}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
