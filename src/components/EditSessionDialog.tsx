import { SessionPlanningWizardSheet } from "@/features/session-planning";
import type { SessionPlanningStepId } from "@/features/session-planning";

interface EditSessionDialogProps {
  sessionId: string;
  leadId: string;
  currentDate: string;
  currentTime: string;
  currentNotes?: string;
  currentLocation?: string;
  currentProjectId?: string;
  currentSessionName?: string;
  leadName?: string;
  onSessionUpdated?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  startStep?: SessionPlanningStepId;
}

const EditSessionDialog = ({
  sessionId,
  leadId,
  currentDate,
  currentTime,
  currentProjectId,
  leadName,
  onSessionUpdated,
  open = false,
  onOpenChange,
  startStep,
}: EditSessionDialogProps) => {
  const entrySource = currentProjectId ? "project" : "lead";
  const resolvedStartStep: SessionPlanningStepId = startStep ?? "lead";

  return (
    <SessionPlanningWizardSheet
      mode="edit"
      sessionId={sessionId}
      leadId={leadId}
      leadName={leadName}
      projectId={currentProjectId}
      projectName={undefined}
      defaultDate={currentDate}
      defaultTime={currentTime}
      entrySource={entrySource}
      startStepOverride={resolvedStartStep}
      isOpen={open}
      onOpenChange={onOpenChange ?? (() => {})}
      onSessionScheduled={onSessionUpdated}
      onSessionUpdated={onSessionUpdated}
    />
  );
};

export default EditSessionDialog;
