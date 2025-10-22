import { useMemo } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const CONNECTOR_WORDS = new Set([
  "and",
  "ve",
  "ile",
  "with",
  "und",
  "the",
  "of",
  "for",
  "da",
  "de",
  "del",
  "della",
  "van",
  "von",
  "bin",
  "al",
  "el"
]);

const MAX_INITIALS = 3;

const buildInitials = (name: string, fallback: string) => {
  const trimmed = name.trim();
  if (!trimmed) {
    return fallback;
  }

  const tokens = trimmed.match(/\p{L}+/gu) ?? [];
  const meaningfulTokens = tokens.filter(token => !CONNECTOR_WORDS.has(token.toLowerCase()));
  const candidates = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;

  if (candidates.length === 0) {
    return fallback;
  }

  const initials: string[] = [];
  for (const token of candidates) {
    const chars = Array.from(token);
    const initial = chars[0]?.toUpperCase();
    if (initial) {
      initials.push(initial);
    }
    if (initials.length >= MAX_INITIALS) {
      break;
    }
  }

  if (initials.length === 0) {
    const fallbackToken = candidates[0];
    const fallbackChars = Array.from(fallbackToken).slice(0, MAX_INITIALS).join("").toUpperCase();
    return fallbackChars || fallback;
  }

  const combined = initials.join("");
  return combined || fallback;
};

export interface EntitySummaryItem {
  key: string;
  icon: LucideIcon;
  label: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
  secondaryClassName?: string;
  info?: {
    content: ReactNode;
    ariaLabel?: string;
  };
}

interface EntityHeaderProps {
  name: string;
  title: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  statusBadge?: ReactNode;
  subtext?: ReactNode;
  summaryItems?: EntitySummaryItem[];
  actions?: ReactNode;
  className?: string;
  fallbackInitials?: string;
  avatarClassName?: string;
  avatarContent?: ReactNode;
  banner?: ReactNode;
}

export function EntityHeader({
  name,
  title,
  onBack,
  backLabel = "Back",
  statusBadge,
  subtext,
  summaryItems = [],
  actions,
  className,
  fallbackInitials = "??",
  avatarClassName,
  avatarContent,
  banner
}: EntityHeaderProps) {
  const displayInitials = useMemo(
    () => buildInitials(name, fallbackInitials),
    [name, fallbackInitials]
  );
  const hasSubtext = Boolean(subtext);
  const avatarDisplay = avatarContent ?? displayInitials;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-10 w-10 rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">{backLabel}</span>
            </Button>
          )}
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/40 to-primary/70 text-base font-semibold uppercase text-primary-foreground ring-1 ring-primary/30",
                avatarClassName
              )}
            >
              {avatarDisplay}
            </div>
            <div className={cn("min-w-0", hasSubtext ? "space-y-1" : "")}>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                  {title}
                </h1>
                {statusBadge}
              </div>
              {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
            </div>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {banner && <div>{banner}</div>}

      {summaryItems.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 px-3 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/80 ring-1 ring-border/60">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                    {item.info && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            >
                              <HelpCircle className="h-3 w-3" aria-hidden="true" />
                              <span className="sr-only">{item.info.ariaLabel || item.label}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <span className="block max-w-[220px] text-xs leading-relaxed text-muted-foreground">
                              {item.info.content}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{item.primary}</p>
                  <p className={cn("text-xs text-muted-foreground", item.secondaryClassName)}>
                    {item.secondary}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
