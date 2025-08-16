import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SettingsStickyFooter } from "./SettingsStickyFooter";

interface EnhancedSettingsSectionProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  children: ReactNode;
  // Enhanced functionality
  isDirty?: boolean;
  isSaving?: boolean;
  showSuccess?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
}

const EnhancedSettingsSection = ({ 
  title, 
  description, 
  action, 
  children,
  isDirty = false,
  isSaving = false,
  showSuccess = false,
  onSave,
  onCancel,
  className
}: EnhancedSettingsSectionProps) => {
  const showStickyFooter = isDirty && onSave && onCancel;

  return (
    <div className="relative">
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {title}
                {isDirty && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {action && (
              <Button onClick={action.onClick} className="hidden md:flex items-center gap-2">
                {action.icon}
                {action.label}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
      
      {/* Sticky Footer for this section */}
      {showStickyFooter && (
        <SettingsStickyFooter
          show={isDirty}
          isSaving={isSaving}
          showSuccess={showSuccess}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  );
};

export default EnhancedSettingsSection;