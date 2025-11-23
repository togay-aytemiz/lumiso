import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { Database } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";

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
  const { t: tForms, i18n } = useTranslation("forms");

  const resolvedLanguage = i18n?.resolvedLanguage || i18n?.language || "en";
  const statusTranslations = useMemo(() => {
    const isTurkish = resolvedLanguage.startsWith("tr");

    return {
      statusUpdated: isTurkish ? "Durum Güncellendi" : "Status Updated",
      leadMarkedAs: isTurkish ? "Kişi {{status}} olarak işaretlendi" : "Lead marked as {{status}}",
      leadStatusChanged: isTurkish ? 'Kişi durumu "{{status}}" olarak değiştirildi' : 'Lead status changed to "{{status}}"',
      leadStatusSet: isTurkish ? 'Kişi durumu "{{status}}" olarak ayarlandı' : 'Lead status set to "{{status}}"',
      undo: isTurkish ? "Geri Al" : "Undo",
      undoStatusChange: isTurkish ? "Durum değişikliğini geri al" : "Undo status change",
      undone: isTurkish ? "Geri alındı" : "Undone",
      statusRevertedTo: isTurkish ? "Durum {{status}} olarak geri alındı" : "Status reverted to {{status}}",
      undoFailed: isTurkish ? "Geri alma başarısız" : "Undo failed",
      undoFailedDescription: isTurkish ? "Durum değişikliği geri alınamadı" : "Unable to undo status change",
      unableToUpdateStatus: isTurkish ? "Kişi durumu güncellenemedi" : "Unable to update lead status",
      errorUpdatingStatus: isTurkish ? "Durum güncellenirken hata" : "Error updating status"
    };
  }, [resolvedLanguage]);

  const tStatus = (
    key: keyof typeof statusTranslations,
    options?: Record<string, string>
  ) =>
    tForms(`status.${key}`, {
      lng: resolvedLanguage,
      fallbackLng: false,
      defaultValue: statusTranslations[key],
      ...options
    });

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
        title: tStatus("statusUpdated"),
        description: tStatus("leadMarkedAs", {
          status: displayName ?? targetStatus.name
        }),
        action: previousStatus?.name || previousStatus?.id ? (
          <ToastAction
            altText={tStatus("undoStatusChange")}
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
                  title: tStatus("undone"),
                  description: tStatus("statusRevertedTo", {
                    status: prevStatusData.name
                  })
                });
              } catch (error: unknown) {
                const message =
                  error instanceof Error
                    ? error.message
                    : tStatus("undoFailedDescription");
                toast({
                  title: tStatus("undoFailed"),
                  description: message,
                  variant: "destructive"
                });
              }
            }}
          >
            {tStatus("undo")}
          </ToastAction>
        ) : undefined
      });

    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : tStatus("unableToUpdateStatus");
      toast({
        title: tStatus("errorUpdatingStatus"),
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
