import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoSaveToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  isSaving?: boolean;
  showSuccess?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AutoSaveToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  isSaving = false,
  showSuccess = false,
  disabled = false,
  className
}: AutoSaveToggleProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <Label 
            htmlFor={id} 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
          </Label>
          {isSaving && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
          {showSuccess && !isSaving && (
            <Check className="h-3 w-3 text-green-600 animate-in fade-in zoom-in duration-300" />
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled || isSaving}
        className="shrink-0"
      />
    </div>
  );
}