import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LeadFieldValue } from '@/types/leadFields';
import { useToast } from '@/hooks/use-toast';

export function useLeadFieldValues(leadId?: string) {
  const [fieldValues, setFieldValues] = useState<LeadFieldValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFieldValues = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('lead_field_values')
        .select('*')
        .eq('lead_id', id);

      if (fetchError) {
        throw fetchError;
      }

      setFieldValues(data || []);
    } catch (err) {
      console.error('Error fetching field values:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch field values');
    } finally {
      setLoading(false);
    }
  };

  const upsertFieldValues = async (leadId: string, values: Record<string, string | null>) => {
    try {
      const upserts = Object.entries(values).map(([fieldKey, value]) => ({
        lead_id: leadId,
        field_key: fieldKey,
        value: value
      }));

      const { data, error } = await supabase
        .from('lead_field_values')
        .upsert(upserts, { 
          onConflict: 'lead_id,field_key',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        throw error;
      }

      // Update local state
      setFieldValues(prev => {
        const updated = [...prev];
        data.forEach(newValue => {
          const existingIndex = updated.findIndex(
            v => v.lead_id === newValue.lead_id && v.field_key === newValue.field_key
          );
          if (existingIndex >= 0) {
            updated[existingIndex] = newValue;
          } else {
            updated.push(newValue);
          }
        });
        return updated;
      });

      return data;
    } catch (err) {
      console.error('Error upserting field values:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to save field values',
        variant: "destructive",
      });
      throw err;
    }
  };

  const getFieldValue = (fieldKey: string): string | null => {
    const fieldValue = fieldValues.find(fv => fv.field_key === fieldKey);
    return fieldValue?.value || null;
  };

  const getFieldValuesAsRecord = (): Record<string, string | null> => {
    return fieldValues.reduce((acc, fv) => {
      acc[fv.field_key] = fv.value;
      return acc;
    }, {} as Record<string, string | null>);
  };

  useEffect(() => {
    if (leadId) {
      fetchFieldValues(leadId);
    }
  }, [leadId]);

  return {
    fieldValues,
    loading,
    error,
    refetch: leadId ? () => fetchFieldValues(leadId) : undefined,
    upsertFieldValues,
    getFieldValue,
    getFieldValuesAsRecord
  };
}