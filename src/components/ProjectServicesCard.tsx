import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Plus } from "lucide-react";

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
  itemAlign = "center"
}: ProjectServicesCardProps) {
  const hasItems = items.length > 0;
  const alignmentClass = itemAlign === "start" ? "items-start" : "items-center";

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground"
              aria-label={tooltipAriaLabel}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-2 text-sm leading-relaxed">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </div>
      {hasItems ? (
        <>
          <div className="mt-3 space-y-2">
            {items.map(({ key, left, right }) => (
              <div
                key={key}
                className={`flex ${alignmentClass} justify-between gap-3 text-sm`}
              >
                <div className="min-w-0">{left}</div>
                {right ? <div className="shrink-0">{right}</div> : null}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="link" className="h-auto px-0 text-sm font-semibold" onClick={onAdd}>
              <Plus className="mr-1 h-4 w-4" />
              {addButtonLabel}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
