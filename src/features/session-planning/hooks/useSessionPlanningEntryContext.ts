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
  mode
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
      mode
    }),
    [leadId, leadName, projectId, projectName, defaultDate, defaultTime, entrySource, sessionId, mode]
  );
