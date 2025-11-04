import { ReactNode, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  sectionId?: string;
  className?: string;
}

const SettingsSection = ({
  title,
  description,
  action,
  actions,
  children,
  sectionId,
  className
}: SettingsSectionProps) => {
  const renderedAction = action ? (
    <Button onClick={action.onClick} className="flex items-center gap-2 whitespace-nowrap">
      {action.icon}
      {action.label}
    </Button>
  ) : null;

  const resolvedId = useMemo(() => {
    if (sectionId?.trim()) {
      return sectionId.trim();
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (slug) {
      return slug;
    }

    let hash = 0;
    for (let index = 0; index < title.length; index += 1) {
      const charCode = title.charCodeAt(index);
      hash = (hash << 5) - hash + charCode;
      hash |= 0;
    }

    return `section-${Math.abs(hash).toString(36) || "default"}`;
  }, [sectionId, title]);

  return (
    <Card
      id={resolvedId}
      data-settings-section="true"
      data-settings-section-title={title}
      className={cn("scroll-mt-28", className)}
    >
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
