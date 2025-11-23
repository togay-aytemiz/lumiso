import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { Database } from "@/integrations/supabase/types";

interface UseLeadStatusActionsProps {
  leadId: string;
  onStatusChange: () => void;
  organizationId?: string | null;
  statuses?: Array<Database["public"]["Tables"]["lead_statuses"]["Row"]>;
}

type LeadStatusRow = Database["public"]["Tables"]["lead_statuses"]["Row"];

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();

export function useLeadStatusActions({
  leadId,
  onStatusChange,
  organizationId,
  statuses,
}: UseLeadStatusActionsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const resolveStatusByLifecycle = async (
    lifecycle: "completed" | "cancelled"
  ): Promise<Pick<LeadStatusRow, "id" | "name"> | null> => {
    const normalizedLifecycle = lifecycle.toLowerCase();
    const fromState = statuses?.find(
      (status) => normalize(status.lifecycle) === normalizedLifecycle
    );
    if (fromState) {
      return { id: fromState.id, name: fromState.name };
    }

    if (!organizationId) return null;

    const { data, error } = await supabase
      .from<LeadStatusRow>("lead_statuses")
      .select("id, name, lifecycle")
      .eq("organization_id", organizationId)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    const match = (data ?? []).find(
      (status) => normalize(status.lifecycle) === normalizedLifecycle
    );
    return match ? { id: match.id, name: match.name } : null;
  };

  const resolveStatusByIdOrName = async (
    id?: string | null,
    name?: string | null
  ): Promise<Pick<LeadStatusRow, "id" | "name"> | null> => {
    const normalizedName = normalize(name);
    const fromState = statuses?.find(
      (status) => (id && status.id === id) || (!!normalizedName && normalize(status.name) === normalizedName)
    );
    if (fromState) {
      return { id: fromState.id, name: fromState.name };
    }

    if (!organizationId) return null;

    if (id) {
      const { data, error } = await supabase
        .from<LeadStatusRow>("lead_statuses")
        .select("id, name")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (data) return { id: data.id, name: data.name };
    }

    if (normalizedName) {
      const { data, error } = await supabase
        .from<LeadStatusRow>("lead_statuses")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("name", name)
        .maybeSingle();
      if (error) throw error;
      if (data) return { id: data.id, name: data.name };
    }

    return null;
  };

  const updateLeadStatus = async (
    targetStatus: Pick<LeadStatusRow, "id" | "name">,
    previousStatus?: { id?: string | null; name?: string | null },
    displayName?: string
  ) => {
    setIsUpdating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('leads')
        .update({ 
          status_id: targetStatus.id,
          status: targetStatus.name // Keep text field updated for backward compatibility
        })
        .eq('id', leadId);

      if (error) throw error;

      onStatusChange();

      // Show toast with undo functionality
      const undoRef = { current: false };
      
      toast({
        title: "Status Updated",
        description: `Lead marked as ${displayName ?? targetStatus.name}`,
        action: previousStatus?.name || previousStatus?.id ? (
          <ToastAction
            altText="Undo status change"
            onClick={async () => {
              if (undoRef.current) return; // Prevent multiple clicks
              undoRef.current = true;
              
              try {
                const prevStatusData = await resolveStatusByIdOrName(
                  previousStatus?.id,
                  previousStatus?.name
                );

                if (!prevStatusData) throw new Error('Previous status not found');

                const { error: undoError } = await supabase
                  .from('leads')
                  .update({ 
                    status_id: prevStatusData.id,
                    status: prevStatusData.name 
                  })
                  .eq('id', leadId);

                if (undoError) throw undoError;

                onStatusChange();
                toast({
                  title: "Undone",
                  description: `Status reverted to ${prevStatusData.name}`
                });
              } catch (error: unknown) {
                const message =
                  error instanceof Error ? error.message : "Unable to undo status change";
                toast({
                  title: "Undo failed",
                  description: message,
                  variant: "destructive"
                });
              }
            }}
          >
            Undo
          </ToastAction>
        ) : undefined
      });

    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to update lead status";
      toast({
        title: "Error updating status",
        description: message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const markAsCompleted = async (
    previousStatus?: string,
    customCompletedLabel?: string,
    previousStatusId?: string | null
  ) => {
    const status = await resolveStatusByLifecycle("completed");
    if (!status) {
      throw new Error('Completed status not found');
    }
    const previous =
      previousStatus || previousStatusId
        ? { id: previousStatusId, name: previousStatus }
        : undefined;
    return updateLeadStatus(
      status,
      previous,
      customCompletedLabel
    );
  };

  const markAsLost = async (
    previousStatus?: string,
    customLostLabel?: string,
    previousStatusId?: string | null
  ) => {
    const status = await resolveStatusByLifecycle("cancelled");
    if (!status) {
      throw new Error('Lost status not found');
    }
    const previous =
      previousStatus || previousStatusId
        ? { id: previousStatusId, name: previousStatus }
        : undefined;
    return updateLeadStatus(
      status,
      previous,
      customLostLabel
    );
  };

  return {
    markAsCompleted,
    markAsLost,
    isUpdating
  };
}
