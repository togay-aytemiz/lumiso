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
  className,
}: SettingsStickyFooterProps) {
  const { t } = useTranslation("common");
  if (!show) return null;

  return (
    <div
      className={cn(
        "sticky bottom-0 left-0 right-0 z-10 border-t border-border/80 bg-card/95 backdrop-blur-md transition-all duration-200 ease-in-out",
        "animate-in slide-in-from-bottom-2",
        className
      )}
    >
      <div className="flex w-full items-center justify-end gap-2 px-4 py-4 sm:px-0">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
          className={cn(
            "h-9 min-w-[80px] rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors",
            "hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/40"
          )}
        >
          {t("buttons.cancel")}
        </Button>
        <Button
          onClick={onSave}
          disabled={isSaving}
          className={cn(
            "h-9 min-w-[128px] rounded-md px-4 text-sm font-semibold text-[hsl(var(--accent-900))]",
            "bg-[hsl(var(--accent-200))] hover:bg-[hsl(var(--accent-300))] focus-visible:ring-[hsl(var(--accent-300))]",
            "disabled:opacity-70"
          )}
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
