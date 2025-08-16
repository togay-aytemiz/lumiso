import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsStickyFooterProps {
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

  return (
    <div 
      className={cn(
        "sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-10 transition-all duration-200 ease-in-out",
        "animate-in slide-in-from-bottom-2",
        className
      )}
    >
      <div className="flex items-center justify-end gap-3 max-w-7xl mx-auto">
        <Button 
          variant="outline" 
          onClick={onCancel}
          disabled={isSaving}
          className="h-10 min-w-[80px]"
        >
          Cancel
        </Button>
        <Button 
          onClick={onSave}
          disabled={isSaving}
          className="h-10 min-w-[120px] flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : showSuccess ? (
            <>
              <Check className="h-4 w-4" />
              Saved
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  );
}