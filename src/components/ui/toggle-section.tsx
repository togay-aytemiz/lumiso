import { useEffect, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Switch } from "./switch";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent } from "./collapsible";

interface ToggleSectionProps {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  summary?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export const ToggleSection = ({
  title,
  description,
  enabled,
  onToggle,
  summary,
  children,
  defaultExpanded,
}: ToggleSectionProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded ?? enabled);

  useEffect(() => {
    if (enabled) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  }, [defaultExpanded, enabled]);

  const toggleExpanded = () => {
    if (!enabled) return;
    setExpanded((prev) => !prev);
  };

  const handleToggle = (checked: boolean) => {
    onToggle(checked);
    if (checked) {
      setExpanded(true);
    } else {
      setExpanded(false);
    }
  };

  return (
    <Collapsible
      open={enabled && expanded}
      onOpenChange={(open) => {
        if (!enabled) return;
        setExpanded(open);
      }}
      className={cn(
        "rounded-2xl border transition-colors duration-300 overflow-hidden",
        enabled
          ? "border-primary/40 bg-primary/5 shadow-[0_12px_28px_-18px_rgba(16,185,129,0.45)]"
          : "border-dashed border-border/60 bg-muted/20"
      )}
    >
      <div className="flex items-start gap-4 p-4">
        <button
          type="button"
          className={cn(
            "mt-1 flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            enabled
              ? "border-primary/30 bg-white text-primary hover:bg-primary/10"
              : "cursor-default border-border/50 bg-muted/30 text-muted-foreground"
          )}
          onClick={toggleExpanded}
          aria-label={expanded ? "Collapse" : "Expand"}
          disabled={!enabled}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              enabled && expanded ? "rotate-180" : ""
            )}
          />
        </button>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              {description ? (
                <p className="text-xs text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggle} aria-label={title} />
          </div>
          {summary ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 text-xs transition-colors",
                enabled ? "text-primary-700" : "text-muted-foreground"
              )}
            >
              {summary}
            </div>
          ) : null}
        </div>
      </div>
      <CollapsibleContent
        className={cn(
          "overflow-hidden border-t border-primary/20 bg-white/70 px-4 py-4 text-sm transition-all duration-300 ease-out",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2"
        )}
      >
        <div className="space-y-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};
