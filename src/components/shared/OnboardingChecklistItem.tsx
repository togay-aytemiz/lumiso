import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface OnboardingChecklistItemProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function OnboardingChecklistItem({
  icon: Icon,
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
}: OnboardingChecklistItemProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className={cn("text-sm font-semibold leading-snug text-foreground", titleClassName)}>
          {title}
        </div>
        {description && (
          <p className={cn("text-sm leading-snug text-muted-foreground", descriptionClassName)}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
