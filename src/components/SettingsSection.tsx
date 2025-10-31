import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingsSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  children: ReactNode;
}

const SettingsSection = ({ title, description, action, actions, children }: SettingsSectionProps) => {
  const renderedAction = action ? (
    <Button onClick={action.onClick} className="flex items-center gap-2 whitespace-nowrap">
      {action.icon}
      {action.label}
    </Button>
  ) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {(actions || renderedAction) && (
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              {renderedAction}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

export default SettingsSection;
