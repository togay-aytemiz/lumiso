import { useState } from "react";
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
}

export function NewSessionDialogForProject({ 
  leadId, 
  leadName, 
  projectName,
  projectId, 
  onSessionScheduled 
}: NewSessionDialogForProjectProps) {
  const { t } = useFormsTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={cn(
          "min-w-[140px] gap-2 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900"
        )}
        onClick={() => setOpen(true)}
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
        onOpenChange={setOpen}
        onSessionScheduled={onSessionScheduled}
      />
    </>
  );
}
