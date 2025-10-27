import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import type { WorkflowStep } from "@/types/workflow";
import type { TriggerType } from "@/types/workflow";

type WorkflowTriggerConditions = Record<string, unknown> | null | undefined;

const getReminderType = (conditions: WorkflowTriggerConditions) => {
  if (!conditions || typeof conditions !== "object") return null;
  const raw = (conditions as { reminder_type?: unknown }).reminder_type;
  return typeof raw === "string" ? raw : null;
};

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

const SessionWorkflowContext = createContext<SessionWorkflowCatalog | undefined>(undefined);

const getDelayMinutes = (steps: WorkflowStep[]): number | null => {
  if (!steps?.length) return null;
  const delays = steps
    .map((step) => step.delay_minutes ?? null)
    .filter((value): value is number => value !== null);
  if (!delays.length) return null;
  return Math.min(...delays);
};

const hasSummaryEmailStep = (workflow: WorkflowSummary) =>
  workflow.steps.some((step) => {
    if (step.action_type === "send_email") return true;
    if (step.action_type === "send_notification") {
      const channels = step.action_config?.channels as string[] | undefined;
      return Array.isArray(channels) && channels.includes("email");
    }
    return false;
  });

const categorizeWorkflows = (workflows: WorkflowSummary[]) => {
  const reminderIds = new Set<string>();
  const summaryIds = new Set<string>();

  const reminderWorkflows: WorkflowSummary[] = [];
  const summaryWorkflows: WorkflowSummary[] = [];

  for (const workflow of workflows) {
    if (workflow.triggerType === "session_reminder") {
      reminderIds.add(workflow.id);
      reminderWorkflows.push(workflow);
      continue;
    }

    if (workflow.triggerType === "session_scheduled" && hasSummaryEmailStep(workflow)) {
      summaryIds.add(workflow.id);
      summaryWorkflows.push(workflow);
      continue;
    }
  }

  const otherWorkflows = workflows.filter(
    (workflow) => !reminderIds.has(workflow.id) && !summaryIds.has(workflow.id)
  );

  return {
    reminderWorkflows,
    summaryWorkflows,
    otherWorkflows,
  };
};

export const SessionWorkflowProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setWorkflows([]);
        return;
      }

      const { data, error } = await supabase
        .from("workflows")
        .select(
          `
            id,
            name,
            description,
            trigger_type,
            is_active,
            workflow_steps (
              id,
              workflow_id,
              step_order,
              action_type,
              action_config,
              delay_minutes,
              is_active
            ),
            trigger_conditions
          `
        )
        .eq("organization_id", organizationId)
        .in("trigger_type", ["session_scheduled", "session_reminder"])
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const summaries: WorkflowSummary[] =
        data?.map((workflow: any) => {
          const steps: WorkflowStep[] = (workflow.workflow_steps || []).filter(
            (step: WorkflowStep) => step.is_active !== false
          );

          const stepReminderType =
            steps.find((step) => typeof step.action_config?.reminder_type === "string")
              ?.action_config?.reminder_type ?? null;
          const reminderType =
            getReminderType(workflow.trigger_conditions) ??
            (typeof stepReminderType === "string" ? stepReminderType : null);
          const delayMinutes = getDelayMinutes(steps);

          return {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            delayMinutes,
            steps,
            triggerConditions: workflow.trigger_conditions ?? null,
            reminderType,
            triggerType: workflow.trigger_type as TriggerType,
          };
        }) ?? [];

      setWorkflows(summaries);
    } catch (error) {
      console.error("Failed to load session workflows", error);
      toast({
        title: "Error",
        description: "Unable to load notification workflows.",
        variant: "destructive",
      });
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const catalog = useMemo<SessionWorkflowCatalog>(() => {
    const { reminderWorkflows, summaryWorkflows, otherWorkflows } = categorizeWorkflows(workflows);
    const workflowMap = Object.fromEntries(workflows.map((workflow) => [workflow.id, workflow]));

    return {
      loading,
      reminderWorkflows,
      summaryEmailWorkflows: summaryWorkflows,
      otherWorkflows,
      allWorkflows: workflows,
      workflowMap,
      reload: loadWorkflows,
    };
  }, [loading, workflows, loadWorkflows]);

  return (
    <SessionWorkflowContext.Provider value={catalog}>
      {children}
    </SessionWorkflowContext.Provider>
  );
};

export const useSessionWorkflowCatalog = () => {
  const context = useContext(SessionWorkflowContext);
  if (!context) {
    throw new Error("useSessionWorkflowCatalog must be used within a SessionWorkflowProvider");
  }
  return context;
};
