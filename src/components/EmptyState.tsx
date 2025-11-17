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
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  helperAction,
  className,
  align = "center",
  iconClassName
}: EmptyStateProps) {
  const alignmentClasses = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={cn("flex flex-col gap-3 py-10", alignmentClasses, className)}>
      {Icon ? <Icon className={cn("h-10 w-10 text-muted-foreground", iconClassName)} aria-hidden="true" /> : null}
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
