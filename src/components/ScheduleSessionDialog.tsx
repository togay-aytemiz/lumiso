import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "lucide-react";
import { SessionSchedulingSheet } from "@/components/SessionSchedulingSheet";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

interface ScheduleSessionDialogProps {
  leadId: string;
  leadName: string;
  onSessionScheduled?: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
}

const ScheduleSessionDialog = ({ leadId, leadName, onSessionScheduled, disabled = false, disabledTooltip }: ScheduleSessionDialogProps) => {
  const { t } = useFormsTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button disabled className="opacity-50 cursor-not-allowed">
                <Calendar className="h-4 w-4 mr-2" />
                {t("sessions_form.add_session")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{disabledTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Calendar className="h-4 w-4 mr-2" />
          {t("sessions_form.add_session")}
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