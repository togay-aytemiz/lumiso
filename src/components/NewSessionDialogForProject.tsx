import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SessionSchedulingSheet } from "@/components/SessionSchedulingSheet";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';
import { cn } from "@/lib/utils";

interface NewSessionDialogForProjectProps {
  leadId: string;
  leadName: string;
  projectName: string;
  projectId: string;
  onSessionScheduled?: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  onLockedClick?: () => void;
}

export function NewSessionDialogForProject({ 
  leadId, 
  leadName, 
  projectName,
  projectId, 
  onSessionScheduled,
  disabled = false,
  disabledTooltip,
  onLockedClick
}: NewSessionDialogForProjectProps) {
  const { t } = useFormsTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const handleToggle = () => {
    if (disabled) {
      onLockedClick?.();
      return;
    }
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (disabled) {
      setOpen(false);
      return;
    }
    setOpen(nextOpen);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={cn(
          "min-w-[140px] gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900",
          disabled && "cursor-not-allowed opacity-70"
        )}
        onClick={handleToggle}
        aria-disabled={disabled}
        title={disabled ? disabledTooltip : undefined}
      >
        <Plus className="h-4 w-4" />
        {t('sessions.schedule_new')}
      </Button>

      <SessionSchedulingSheet
        leadId={leadId}
        leadName={leadName}
        projectId={projectId}
        projectName={projectName}
        isOpen={open}
        onOpenChange={handleOpenChange}
        onSessionScheduled={onSessionScheduled}
      />
    </>
  );
}
