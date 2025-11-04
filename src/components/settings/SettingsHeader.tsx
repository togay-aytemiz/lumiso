import { ReactNode } from "react";
import { SettingsHelpButton } from "./SettingsHelpButton";
import { cn } from "@/lib/utils";

interface SettingsHelpContent {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

interface SettingsHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: ReactNode;
  helpContent?: SettingsHelpContent;
  className?: string;
}

export default function SettingsHeader({ title, description, eyebrow, children, helpContent, className }: SettingsHeaderProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-wrap items-start justify-between gap-4 sm:gap-6",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        {eyebrow && (
          <span className={cn("settings-eyebrow text-muted-foreground/70", "tracking-[0.28em]")}>{eyebrow}</span>
        )}
        <div className="space-y-1">
          <h2 className={cn("settings-header-title", "text-foreground")}>{title}</h2>
          {description && <p className="settings-header-description">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {helpContent && <SettingsHelpButton helpContent={helpContent} />}
        {children}
      </div>
    </div>
  );
}
