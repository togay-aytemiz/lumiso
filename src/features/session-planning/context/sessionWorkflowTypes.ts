import type { WorkflowStep, TriggerType } from "@/types/workflow";

export type WorkflowTriggerConditions =
  | Record<string, unknown>
  | null
  | undefined;

export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string | null;
  delayMinutes?: number | null;
  steps: WorkflowStep[];
  triggerConditions?: WorkflowTriggerConditions;
  reminderType?: string | null;
  triggerType: TriggerType;
}

export interface SessionWorkflowCatalog {
  loading: boolean;
  reminderWorkflows: WorkflowSummary[];
  summaryEmailWorkflows: WorkflowSummary[];
  otherWorkflows: WorkflowSummary[];
  allWorkflows: WorkflowSummary[];
  workflowMap: Record<string, WorkflowSummary>;
  reload: () => Promise<void>;
}
