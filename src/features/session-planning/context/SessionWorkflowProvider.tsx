import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import type { TriggerType, WorkflowStep } from "@/types/workflow";
import {
  SessionWorkflowContext,
} from "./sessionWorkflowContext";
import type {
  SessionWorkflowCatalog,
  WorkflowSummary,
  WorkflowTriggerConditions,
} from "./sessionWorkflowTypes";

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  is_active: boolean;
  workflow_steps: WorkflowStep[] | null;
  trigger_conditions: WorkflowTriggerConditions;
};

const getReminderType = (conditions: WorkflowTriggerConditions) => {
  if (!conditions || typeof conditions !== "object") return null;
  const raw = (conditions as { reminder_type?: unknown }).reminder_type;
  return typeof raw === "string" ? raw : null;
};

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

const stepHasRequiredTemplate = (step: WorkflowStep) => {
  if (step.action_type !== "send_notification") {
    return true;
  }
  const config = step.action_config as
    | {
        template_id?: unknown;
        templateId?: unknown;
      }
    | undefined;
  const templateId =
    (typeof config?.template_id === "string" && config.template_id.trim().length > 0 && config.template_id) ||
    (typeof config?.templateId === "string" && config.templateId.trim().length > 0 && config.templateId);
  return typeof templateId === "string";
};

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
        ((data ?? []) as WorkflowRow[])
          .map((workflow) => {
            const steps = (workflow.workflow_steps ?? []).filter(
              (step): step is WorkflowStep => step.is_active !== false
            );

            if (!steps.length) {
              return null;
            }

            const missingTemplates = steps.some((step) => !stepHasRequiredTemplate(step));
            if (missingTemplates) {
              return null;
            }

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
          })
          .filter((workflow): workflow is WorkflowSummary => workflow !== null);

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
