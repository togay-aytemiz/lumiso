import { ExternalLink } from "lucide-react";
import { Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface HelpOptionCardProps {
  icon: Icon;
  title: ReactNode;
  description: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
}

export function HelpOptionCard({
  icon: IconComponent,
  title,
  description,
  onSelect,
  disabled = false,
  className,
}: HelpOptionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition-all",
        "hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        disabled && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <IconComponent className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground break-words">{title}</div>
        <div className="text-sm text-muted-foreground break-words">
          {description}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
    </button>
  );
}
