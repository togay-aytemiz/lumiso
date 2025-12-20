import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTranslation } from "react-i18next";
import {
  LEAD_FIELD_DEFINITIONS_GC_TIME,
  LEAD_FIELD_DEFINITIONS_STALE_TIME,
  fetchLeadFieldDefinitionsForOrganization,
  leadFieldDefinitionsQueryKey,
  persistLeadFieldDefinitionsToStorage,
  readLeadFieldDefinitionsFromStorage,
} from "@/services/leadFieldDefinitions";
import {
  LeadFieldDefinition,
  CreateLeadFieldDefinition,
  UpdateLeadFieldDefinition,
} from "@/types/leadFields";

const sortDefinitions = (definitions: LeadFieldDefinition[]) =>
  [...definitions].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

const getMaxSortOrder = (definitions: LeadFieldDefinition[]) =>
  definitions.reduce(
    (max, field) => Math.max(max, field.sort_order ?? 0),
    0
  );

export function useLeadFieldDefinitions() {
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation("forms");

  const query = useQuery({
    queryKey: leadFieldDefinitionsQueryKey(activeOrganizationId),
    queryFn: async () => {
      if (!activeOrganizationId) {
        throw new Error("No active organization found");
      }
      const definitions = await fetchLeadFieldDefinitionsForOrganization(
        activeOrganizationId
      );
      persistLeadFieldDefinitionsToStorage(activeOrganizationId, definitions);
      return definitions;
    },
    enabled: !!activeOrganizationId,
    staleTime: LEAD_FIELD_DEFINITIONS_STALE_TIME,
    gcTime: LEAD_FIELD_DEFINITIONS_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: LEAD_FIELD_DEFINITIONS_STALE_TIME,
    initialData: () =>
      readLeadFieldDefinitionsFromStorage(activeOrganizationId) ??
      readLeadFieldDefinitionsFromStorage(),
  });

  const updateCache = useCallback(
    (updater: (definitions: LeadFieldDefinition[]) => LeadFieldDefinition[]) => {
      if (!activeOrganizationId) return;

      queryClient.setQueryData<LeadFieldDefinition[]>(
        leadFieldDefinitionsQueryKey(activeOrganizationId),
        (current = []) => {
          const next = sortDefinitions(updater(current));
          persistLeadFieldDefinitionsToStorage(activeOrganizationId, next);
          return next;
        }
      );
    },
    [activeOrganizationId, queryClient]
  );

  const ensureOrganizationId = useCallback(() => {
    if (!activeOrganizationId) {
      throw new Error("No active organization found");
    }
    return activeOrganizationId;
  }, [activeOrganizationId]);

  const createFieldDefinition = useCallback(
    async (definition: CreateLeadFieldDefinition) => {
      const organizationId = ensureOrganizationId();

      try {
        const snapshot =
          queryClient.getQueryData<LeadFieldDefinition[]>(
            leadFieldDefinitionsQueryKey(organizationId)
          ) ?? [];
        const maxSortOrder = getMaxSortOrder(snapshot);

        const { data, error } = await supabase
          .from("lead_field_definitions")
          .insert({
            ...definition,
            organization_id: organizationId,
            sort_order: definition.sort_order ?? maxSortOrder + 1,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        updateCache((prev) => [...prev, data as LeadFieldDefinition]);

        toast({
          title: t("lead_field.toast.create_success_title"),
          description: t("lead_field.toast.create_success_description", {
            fieldName: definition.label,
          }),
        });

        return data;
      } catch (err) {
        console.error("Error creating field definition:", err);
        toast({
          title: t("lead_field.toast.error_title"),
          description:
            err instanceof Error
              ? err.message
              : t("lead_field.toast.create_error_description"),
          variant: "destructive",
        });
        throw err;
      }
    },
    [ensureOrganizationId, queryClient, t, toast, updateCache]
  );

  const updateFieldDefinition = useCallback(
    async (id: string, updates: UpdateLeadFieldDefinition) => {
      try {
        const { data, error } = await supabase
          .from("lead_field_definitions")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        updateCache((prev) =>
          prev.map((field) =>
            field.id === id ? (data as LeadFieldDefinition) : field
          )
        );

        toast({
          title: t("lead_field.toast.update_success_title"),
          description: t("lead_field.toast.update_success_description"),
        });

        return data;
      } catch (err) {
        console.error("Error updating field definition:", err);
        toast({
          title: t("lead_field.toast.error_title"),
          description:
            err instanceof Error
              ? err.message
              : t("lead_field.toast.update_error_description"),
          variant: "destructive",
        });
        throw err;
      }
    },
    [t, toast, updateCache]
  );

  const deleteFieldDefinition = useCallback(
    async (id: string) => {
      const organizationId = ensureOrganizationId();

      try {
        const snapshot =
          queryClient.getQueryData<LeadFieldDefinition[]>(
            leadFieldDefinitionsQueryKey(organizationId)
          ) ?? [];
        const field = snapshot.find((f) => f.id === id);

        if (!field) {
          throw new Error("Field not found");
        }

        if (field.is_system) {
          throw new Error("System fields cannot be deleted");
        }

        const { data: deletedField, error } = await supabase
          .from("lead_field_definitions")
          .delete()
          .eq("id", id)
          .select();

        if (error) {
          throw error;
        }

        if (!deletedField || deletedField.length === 0) {
          throw new Error(
            "Field could not be deleted. You may not have permission or the field does not exist."
          );
        }

        const { error: valuesError } = await supabase
          .from("lead_field_values")
          .delete()
          .eq("field_key", field.field_key);

        if (valuesError) {
          console.warn("Error deleting field values:", valuesError);
        }

        updateCache((prev) => prev.filter((item) => item.id !== id));

        toast({
          title: t("lead_field.toast.delete_success_title"),
          description: t("lead_field.toast.delete_success_description", {
            fieldName: field.label,
          }),
        });
      } catch (err) {
        console.error("Error deleting field definition:", err);
        toast({
          title: t("lead_field.toast.error_title"),
          description:
            err instanceof Error
              ? err.message
              : t("lead_field.toast.delete_error_description"),
          variant: "destructive",
        });
        throw err;
      }
    },
    [ensureOrganizationId, queryClient, t, toast, updateCache]
  );

  const reorderFieldDefinitions = useCallback(
    async (reorderedFields: LeadFieldDefinition[]) => {
      const organizationId = ensureOrganizationId();

      try {
        const normalizedFields = reorderedFields.map((field, index) => ({
          ...field,
          sort_order: index + 1,
        }));

        await Promise.all(
          normalizedFields.map((field) =>
            supabase
              .from("lead_field_definitions")
              .update({ sort_order: field.sort_order })
              .eq("id", field.id)
          )
        );

        updateCache(() => normalizedFields);

        toast({
          title: t("lead_field.toast.reorder_success_title"),
          description: t("lead_field.toast.reorder_success_description"),
        });
      } catch (err) {
        console.error("Error reordering fields:", err);
        toast({
          title: t("lead_field.toast.error_title"),
          description:
            err instanceof Error
              ? err.message
              : t("lead_field.toast.reorder_error_description"),
          variant: "destructive",
        });
        throw err;
      }
    },
    [ensureOrganizationId, t, toast, updateCache]
  );

  const error =
    query.error instanceof Error
      ? query.error.message
      : query.error
        ? String(query.error)
        : null;

  const isInitialLoading = query.isLoading;
  const isRefetching = query.isRefetching;

  return {
    fieldDefinitions: query.data ?? [],
    loading: isInitialLoading,
    isRefetching,
    error,
    refetch: query.refetch,
    createFieldDefinition,
    updateFieldDefinition,
    deleteFieldDefinition,
    reorderFieldDefinitions,
  };
}
