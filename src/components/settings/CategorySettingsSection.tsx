import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsContext } from "@/contexts/SettingsContext";

interface CategorySettingsSectionProps {
  title: string;
  description?: string;
  sectionId: string;
  children: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
  'data-walkthrough'?: string;
}

export function CategorySettingsSection({
  title,
  description,
  sectionId,
  children,
  action,
  className,
  'data-walkthrough': dataWalkthrough
}: CategorySettingsSectionProps) {
  const location = useLocation();
  const categoryPath = location.pathname;
  const { categoryChanges } = useSettingsContext();
  
  const section = categoryChanges[categoryPath]?.[sectionId];
  const isDirty = section?.isDirty || false;

  return (
    <Card className={cn("", className)} data-walkthrough={dataWalkthrough}>
      <CardHeader className="space-y-4 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <CardTitle className="text-xl">{title}</CardTitle>
            {/* Dirty indicator */}
            {isDirty && (
              <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            )}
          </div>
          
          {action && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={action.onClick}
              className="flex w-full items-center justify-center gap-2 sm:w-auto sm:justify-center"
            >
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
        </div>
        
        {description && (
          <CardDescription className="text-base">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {children}
      </CardContent>
    </Card>
  );
}
