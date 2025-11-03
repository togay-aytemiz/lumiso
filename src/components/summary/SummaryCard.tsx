import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SummarySectionHeading = ({ children }: { children: string }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
);

interface SummaryCardProps {
  title: string;
  primary?: ReactNode;
  helper?: ReactNode;
  footer?: ReactNode;
  helperClassName?: string;
  className?: string;
  contentClassName?: string;
}

export const SummaryCard = ({
  title,
  primary,
  helper,
  footer,
  helperClassName,
  className,
  contentClassName,
}: SummaryCardProps) => {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {primary ? (
        <div className={cn("mt-2 text-sm font-semibold text-slate-900", contentClassName)}>{primary}</div>
      ) : null}
      {helper ? (
        <div className={cn("mt-1 text-xs text-muted-foreground", helperClassName)}>{helper}</div>
      ) : null}
      {footer ? <div className="mt-3 text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
};

SummaryCard.displayName = "SummaryCard";

interface SummaryMetricProps {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "positive" | "negative";
  className?: string;
}

export const SummaryMetric = ({ label, value, helper, tone, className }: SummaryMetricProps) => {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2 text-sm shadow-sm",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold text-slate-900",
          tone === "positive" && "text-emerald-600",
          tone === "negative" && "text-destructive"
        )}
      >
        {value}
      </p>
      {helper ? <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p> : null}
    </div>
  );
};
