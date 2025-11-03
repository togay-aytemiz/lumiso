import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SummaryTotalsCard = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "w-full space-y-3 rounded-xl border border-border/60 bg-white p-4 shadow-sm",
      className
    )}
  >
    {children}
  </div>
);

export const SummaryTotalsSection = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => <div className={cn("space-y-2", className)}>{children}</div>;

export const SummaryTotalsDivider = ({ className }: { className?: string }) => (
  <div className={cn("border-t border-border/60", className)} />
);

export const SummaryTotalRow = ({
  label,
  value,
  helper,
  tone,
  emphasizeLabel,
}: {
  label: ReactNode;
  value: ReactNode;
  helper?: ReactNode;
  tone?: "positive" | "negative";
  emphasizeLabel?: boolean;
}) => {
  const labelClass = cn(
    "text-sm",
    emphasizeLabel ? "font-semibold text-slate-900" : "text-muted-foreground"
  );

  const valueClass = cn(
    "text-sm font-medium text-slate-900",
    tone === "positive" && "text-emerald-600",
    tone === "negative" && "text-destructive"
  );

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className={labelClass}>{label}</span>
        <span className={valueClass}>{value}</span>
      </div>
      {helper ? <div className="text-xs text-right text-muted-foreground">{helper}</div> : null}
    </div>
  );
};
