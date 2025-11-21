import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  helperAction?: ReactNode;
  className?: string;
  align?: "center" | "start";
  iconClassName?: string;
  iconVariant?: "default" | "pill";
  iconColor?: "emerald" | "indigo" | "amber" | "rose" | "slate";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  helperAction,
  className,
  align = "center",
  iconClassName,
  iconVariant = "default",
  iconColor = "slate"
}: EmptyStateProps) {
  const alignmentClasses = align === "center" ? "items-center text-center" : "items-start text-left";

  const getColorClasses = (color: string) => {
    switch (color) {
      case "emerald":
        return "bg-emerald-50 text-emerald-500 ring-emerald-50/50";
      case "indigo":
        return "bg-indigo-50 text-indigo-500 ring-indigo-50/50";
      case "amber":
        return "bg-amber-50 text-amber-500 ring-amber-50/50";
      case "rose":
        return "bg-rose-50 text-rose-500 ring-rose-50/50";
      default:
        return "bg-slate-50 text-slate-500 ring-slate-50/50";
    }
  };

  return (
    <div className={cn("flex flex-col gap-3 py-10", alignmentClasses, className)}>
      {Icon ? (
        iconVariant === "pill" ? (
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full ring-4 mb-1", getColorClasses(iconColor), iconClassName)}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
        ) : (
          <Icon className={cn("h-10 w-10 text-muted-foreground", iconClassName)} aria-hidden="true" />
        )
      ) : null}
      <div className="space-y-1">
        <p className="text-base font-medium text-foreground">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {helperAction ? (
          <div className={cn("text-sm", align === "center" ? "flex justify-center" : "")}>{helperAction}</div>
        ) : null}
      </div>
      {action ? (
        <div className={cn("mt-2", align === "center" ? "flex justify-center" : "")}>
          {action}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
