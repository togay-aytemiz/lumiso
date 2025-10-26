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
}

export const useSessionPlanningEntryContext = ({
  leadId,
  leadName,
  projectId,
  projectName,
  defaultDate,
  defaultTime,
  entrySource
}: UseSessionPlanningEntryContextProps): SessionPlanningEntryContext =>
  useMemo(
    () => ({
      leadId,
      leadName,
      projectId,
      projectName,
      defaultDate,
      defaultTime,
      entrySource
    }),
    [leadId, leadName, projectId, projectName, defaultDate, defaultTime, entrySource]
  );

