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
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{title}</CardTitle>
              {/* Dirty indicator */}
              {isDirty && (
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
          
          {action && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={action.onClick}
              className="flex items-center gap-2"
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