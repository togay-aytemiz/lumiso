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
          "min-w-[140px] gap-2 border-indigo-500 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 hover:text-indigo-900"
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
