import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useWorkflowTriggers } from "@/hooks/useWorkflowTriggers";
import { useFormsTranslation } from "@/hooks/useTypedTranslation";

export interface ProjectStatus {
  id: string;
  name: string;
  color: string;
}

interface UseProjectStatusControllerOptions {
  projectId: string;
  currentStatusId?: string | null;
  onStatusChange?: () => void;
  statuses?: ProjectStatus[];
  statusesLoading?: boolean;
}

interface UseProjectStatusControllerResult {
  statuses: ProjectStatus[];
  currentStatus: ProjectStatus | null;
  loading: boolean;
  isUpdating: boolean;
  handleStatusChange: (newStatusId: string) => Promise<void>;
}

export function useProjectStatusController({
  projectId,
  currentStatusId,
  onStatusChange,
  statuses: passedStatuses,
  statusesLoading
}: UseProjectStatusControllerOptions): UseProjectStatusControllerResult {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([]);
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { triggerProjectMilestone } = useNotificationTriggers();
  const { activeOrganization } = useOrganization();
  const { triggerProjectStatusChange } = useWorkflowTriggers();
  const { t: tForms } = useFormsTranslation();

  const fetchProjectStatuses = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error("Error fetching project statuses:", error);
      toast({
        title: tForms("status.errorUpdatingStatus"),
        description: tForms("status.statusNotFound"),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast, tForms]);

  useEffect(() => {
    if (passedStatuses === undefined) {
      fetchProjectStatuses();
      return;
    }

    setStatuses(passedStatuses);
    if (typeof statusesLoading === "boolean") {
      setLoading(statusesLoading);
    } else {
      setLoading(false);
    }
  }, [fetchProjectStatuses, passedStatuses, statusesLoading]);

  useEffect(() => {
    if (currentStatusId && statuses.length > 0) {
      const status = statuses.find(statusItem => statusItem.id === currentStatusId);
      setCurrentStatus(status || null);
    } else if (!currentStatusId) {
      setCurrentStatus(null);
    }
  }, [currentStatusId, statuses]);

  const handleStatusChange = useCallback(
    async (newStatusId: string) => {
      if (currentStatus && newStatusId === currentStatus.id) return;

      setIsUpdating(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("User not authenticated");

        const nextStatus = statuses.find(statusItem => statusItem.id === newStatusId);
        if (!nextStatus) throw new Error(tForms("status.statusNotFound"));
        const organizationId = activeOrganization?.id ?? null;

        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("lead_id")
          .eq("id", projectId)
          .single();

        if (projectError) throw projectError;

        const { error: updateError } = await supabase
          .from("projects")
          .update({ status_id: newStatusId })
          .eq("id", projectId);

        if (updateError) throw updateError;

        if (organizationId) {
          const notSetLabel = tForms("activitiesHistory.historyMessages.notSet");
          const statusMessage = currentStatus
            ? tForms("activities.status_changed", {
                old: currentStatus.name || notSetLabel,
                next: nextStatus.name || notSetLabel
              })
            : tForms("activities.status_set", {
                status: nextStatus.name || notSetLabel
              });

          const { error: activityError } = await supabase
            .from("activities")
            .insert({
              content: statusMessage,
              type: "status_change",
              project_id: projectId,
              lead_id: projectData.lead_id,
              user_id: userData.user.id,
              organization_id: organizationId
            });

          if (activityError) {
            console.error("Error logging activity:", activityError);
          }
        }

        setCurrentStatus(nextStatus);
        onStatusChange?.();

        const notSetLabel = tForms("activitiesHistory.historyMessages.notSet");
        const description = currentStatus
          ? tForms("activities.status_changed", {
              old: currentStatus.name || notSetLabel,
              next: nextStatus.name || notSetLabel
            })
          : tForms("activities.status_set", {
              status: nextStatus.name || notSetLabel
            });

        toast({
          title: tForms("status.statusUpdated"),
          description
        });

        if (organizationId && currentStatus?.id) {
          await triggerProjectMilestone(projectId, currentStatus.id, newStatusId, organizationId);
        }

        if (organizationId && currentStatus?.id) {
          try {
            await triggerProjectStatusChange(projectId, organizationId, currentStatus.name, nextStatus.name, {
              old_status_id: currentStatus.id,
              new_status_id: newStatusId,
              project_id: projectId,
              lead_id: projectData.lead_id
            });
          } catch (workflowError) {
            console.error("Error triggering project status workflow:", workflowError);
          }
        }
      } catch (error: unknown) {
        toast({
          title: tForms("status.errorUpdatingStatus"),
          description:
            error instanceof Error
              ? error.message
              : tForms("status.genericError", {
                  defaultValue: "We couldn't update the project status.",
                }),
          variant: "destructive"
        });
      } finally {
        setIsUpdating(false);
      }
    },
    [
      activeOrganization?.id,
      currentStatus,
      onStatusChange,
      projectId,
      statuses,
      tForms,
      toast,
      triggerProjectMilestone,
      triggerProjectStatusChange
    ]
  );

  return useMemo(
    () => ({
      statuses,
      currentStatus,
      loading,
      isUpdating,
      handleStatusChange
    }),
    [currentStatus, handleStatusChange, isUpdating, loading, statuses]
  );
}
