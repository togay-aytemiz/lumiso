import { ReactNode } from "react";
import { SettingsHelpButton } from "./SettingsHelpButton";

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
  children?: ReactNode;
  helpContent?: SettingsHelpContent;
}

export default function SettingsHeader({ title, description, children, helpContent }: SettingsHeaderProps) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          {helpContent && <SettingsHelpButton helpContent={helpContent} />}
          {children}
        </div>
      </div>
    </div>
  );
}