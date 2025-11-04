import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface SettingsStickyFooterProps {
  show: boolean;
  isSaving: boolean;
  showSuccess?: boolean;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
}

export function SettingsStickyFooter({ 
  show, 
  isSaving, 
  showSuccess, 
  onSave, 
  onCancel, 
  className 
}: SettingsStickyFooterProps) {
  if (!show) return null;
  const { t } = useTranslation("common");

  return (
    <div 
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10 border-t border-border/80 bg-card/95 backdrop-blur-md transition-all duration-200 ease-in-out",
        "animate-in slide-in-from-bottom-2",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-2 px-4 sm:px-0">
        <Button 
          variant="ghost" 
          onClick={onCancel}
          disabled={isSaving}
          className="h-9 min-w-[72px] rounded-full px-5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("buttons.cancel")}
        </Button>
        <Button 
          onClick={onSave}
          disabled={isSaving}
          className="h-9 min-w-[120px] rounded-full px-5 text-sm font-semibold"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("actions.saving")}
            </>
          ) : showSuccess ? (
            <>
              <Check className="h-4 w-4" />
              {t("toast.settingsSavedTitle")}
            </>
          ) : (
            t("buttons.save_changes")
          )}
        </Button>
      </div>
    </div>
  );
}
