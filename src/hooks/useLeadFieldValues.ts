import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LeadFieldValue } from "@/types/leadFields";
import { useToast } from "@/hooks/use-toast";

const leadFieldValuesQueryKey = (leadId?: string) =>
  ["lead_field_values", leadId] as const;

const STALE_TIME = 3 * 60 * 1000; // 3 minutes
const GC_TIME = 15 * 60 * 1000; // 15 minutes

async function fetchLeadFieldValues(leadId: string): Promise<LeadFieldValue[]> {
  const { data, error } = await supabase
    .from("lead_field_values")
    .select("*")
    .eq("lead_id", leadId);

  if (error) {
    throw error;
  }

  return (data || []) as LeadFieldValue[];
}

export function useLeadFieldValues(leadId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: leadFieldValuesQueryKey(leadId),
    queryFn: () => {
      if (!leadId) {
        return Promise.resolve<LeadFieldValue[]>([]);
      }
      return fetchLeadFieldValues(leadId);
    },
    enabled: !!leadId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false,
  });

  const upsertFieldValues = async (
    targetLeadId: string,
    values: Record<string, string | null>
  ) => {
    try {
      const upserts = Object.entries(values).map(([fieldKey, value]) => ({
        lead_id: targetLeadId,
        field_key: fieldKey,
        value,
      }));

      const { data, error } = await supabase
        .from("lead_field_values")
        .upsert(upserts, {
          onConflict: "lead_id,field_key",
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        throw error;
      }

      queryClient.setQueryData<LeadFieldValue[]>(
        leadFieldValuesQueryKey(targetLeadId),
        (current = []) => {
          const next = [...current];
          (data || []).forEach((newValue) => {
            const index = next.findIndex(
              (existing) =>
                existing.lead_id === newValue.lead_id &&
                existing.field_key === newValue.field_key
            );
            if (index >= 0) {
              next[index] = newValue;
            } else {
              next.push(newValue);
            }
          });
          return next;
        }
      );

      return data;
    } catch (err) {
      console.error("Error upserting field values:", err);
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to save field values",
        variant: "destructive",
      });
      throw err;
    }
  };

  const fieldValues = leadId ? query.data ?? [] : [];
  const loading = leadId ? query.isLoading || query.isFetching : false;
  const error =
    query.error instanceof Error
      ? query.error.message
      : query.error
      ? String(query.error)
      : null;

  const getFieldValue = (fieldKey: string): string | null => {
    const fieldValue = fieldValues.find(
      (value) => value.field_key === fieldKey
    );
    return fieldValue?.value ?? null;
  };

  const getFieldValuesAsRecord = (): Record<string, string | null> => {
    return fieldValues.reduce<Record<string, string | null>>((acc, value) => {
      acc[value.field_key] = value.value;
      return acc;
    }, {});
  };

  return {
    fieldValues,
    loading,
    error,
    refetch: leadId ? query.refetch : undefined,
    upsertFieldValues,
    getFieldValue,
    getFieldValuesAsRecord,
  };
}
