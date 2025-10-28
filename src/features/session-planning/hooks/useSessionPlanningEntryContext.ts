import { useMemo } from "react";
import { SessionPlanningEntryContext } from "../types";

interface UseSessionPlanningEntryContextProps {
  leadId?: string;
  leadName?: string;
  projectId?: string;
  projectName?: string;
  defaultDate?: string;
  defaultTime?: string;
  entrySource?: string;
  sessionId?: string;
  mode?: "create" | "edit";
  startStepOverride?: SessionPlanningEntryContext["startStepOverride"];
}

export const useSessionPlanningEntryContext = ({
  leadId,
  leadName,
  projectId,
  projectName,
  defaultDate,
  defaultTime,
  entrySource,
  sessionId,
  mode,
  startStepOverride
}: UseSessionPlanningEntryContextProps): SessionPlanningEntryContext =>
  useMemo(
    () => ({
      leadId,
      leadName,
      projectId,
      projectName,
      defaultDate,
      defaultTime,
      entrySource,
      sessionId,
      mode,
      startStepOverride
    }),
    [leadId, leadName, projectId, projectName, defaultDate, defaultTime, entrySource, sessionId, mode, startStepOverride]
  );
