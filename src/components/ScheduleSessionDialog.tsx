import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarPlus } from "lucide-react";
import { SessionSchedulingSheet } from "@/components/SessionSchedulingSheet";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";
import { cn } from "@/lib/utils";

interface ScheduleSessionDialogProps {
  leadId: string;
  leadName: string;
  onSessionScheduled?: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  buttonClassName?: string;
}

const ScheduleSessionDialog = ({
  leadId,
  leadName,
  onSessionScheduled,
  disabled = false,
  disabledTooltip,
  buttonClassName
}: ScheduleSessionDialogProps) => {
  const { t } = useFormsTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled
                variant="outline"
                className={cn(
                  "opacity-50 cursor-not-allowed min-w-[140px] gap-2 border-amber-300 bg-amber-50 text-amber-800",
                  buttonClassName
                )}
              >
                <CalendarPlus className="h-4 w-4" />
                {t("sessions.schedule_new")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{disabledTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className={cn(
            "min-w-[140px] gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900",
            buttonClassName
          )}
          variant="outline"
          size="sm"
        >
          <CalendarPlus className="h-4 w-4" />
          {t("sessions.schedule_new")}
        </Button>
      )}

      <SessionSchedulingSheet
        leadId={leadId}
        leadName={leadName}
        isOpen={open}
        onOpenChange={setOpen}
        onSessionScheduled={onSessionScheduled}
      />
    </>
  );
};

export default ScheduleSessionDialog;
