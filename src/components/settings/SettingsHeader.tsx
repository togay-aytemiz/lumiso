import { ReactNode } from "react";

interface SettingsHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function SettingsHeader({ title, description, children }: SettingsHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        {children && (
          <div className="ml-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}