import { SessionPlanningWizardSheet } from "@/features/session-planning";
import type { SessionPlanningStepId } from "@/features/session-planning";

interface SessionSchedulingSheetProps {
  leadId: string;
  leadName: string;
  projectId?: string;
  projectName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionScheduled?: () => void;
  startStep?: SessionPlanningStepId;
}

export function SessionSchedulingSheet({
  leadId,
  leadName,
  projectId,
  projectName,
  isOpen,
  onOpenChange,
  onSessionScheduled,
  startStep,
}: SessionSchedulingSheetProps) {
  const entrySource = projectId ? "project" : "lead";

  return (
    <SessionPlanningWizardSheet
      leadId={leadId}
      leadName={leadName}
      projectId={projectId}
      projectName={projectName}
      entrySource={entrySource}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onSessionScheduled={onSessionScheduled}
      startStepOverride={startStep}
    />
  );
}
