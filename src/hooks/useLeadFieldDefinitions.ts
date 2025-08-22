import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserOrganizationId } from '@/lib/organizationUtils';
import { LeadFieldDefinition, CreateLeadFieldDefinition, UpdateLeadFieldDefinition } from '@/types/leadFields';
import { useToast } from '@/hooks/use-toast';

export function useLeadFieldDefinitions() {
  const [fieldDefinitions, setFieldDefinitions] = useState<LeadFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFieldDefinitions = async () => {
    try {
      setLoading(true);
      setError(null);

      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error('No active organization found');
      }

      const { data, error: fetchError } = await supabase
        .from('lead_field_definitions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setFieldDefinitions((data || []) as LeadFieldDefinition[]);
    } catch (err) {
      console.error('Error fetching field definitions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch field definitions');
    } finally {
      setLoading(false);
    }
  };

  const createFieldDefinition = async (definition: CreateLeadFieldDefinition) => {
    try {
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error('No active organization found');
      }

      // Get the highest sort order and add 1
      const maxSortOrder = Math.max(...fieldDefinitions.map(f => f.sort_order), 0);
      
      const { data, error } = await supabase
        .from('lead_field_definitions')
        .insert({
          ...definition,
          organization_id: organizationId,
          sort_order: definition.sort_order ?? maxSortOrder + 1
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setFieldDefinitions(prev => [...prev, data as LeadFieldDefinition].sort((a, b) => a.sort_order - b.sort_order));
      
      toast({
        title: "Field created",
        description: `Field "${definition.label}" has been created successfully.`,
      });

      return data;
    } catch (err) {
      console.error('Error creating field definition:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to create field',
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateFieldDefinition = async (id: string, updates: UpdateLeadFieldDefinition) => {
    try {
      const { data, error } = await supabase
        .from('lead_field_definitions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setFieldDefinitions(prev => 
        prev.map(field => field.id === id ? data as LeadFieldDefinition : field)
          .sort((a, b) => a.sort_order - b.sort_order)
      );

      toast({
        title: "Field updated",
        description: "Field has been updated successfully.",
      });

      return data;
    } catch (err) {
      console.error('Error updating field definition:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to update field',
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteFieldDefinition = async (id: string) => {
    try {
      const field = fieldDefinitions.find(f => f.id === id);
      if (!field) {
        throw new Error('Field not found');
      }

      if (field.is_system) {
        throw new Error('System fields cannot be deleted');
      }

      const { error } = await supabase
        .from('lead_field_definitions')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Also delete all field values for this field
      await supabase
        .from('lead_field_values')
        .delete()
        .eq('field_key', field.field_key);

      setFieldDefinitions(prev => prev.filter(field => field.id !== id));

      toast({
        title: "Field deleted",
        description: `Field "${field.label}" and all its data have been deleted.`,
      });
    } catch (err) {
      console.error('Error deleting field definition:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to delete field',
        variant: "destructive",
      });
      throw err;
    }
  };

  const reorderFieldDefinitions = async (reorderedFields: LeadFieldDefinition[]) => {
    try {
      // Update sort_order for all fields
      const updates = reorderedFields.map((field, index) => ({
        id: field.id,
        sort_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('lead_field_definitions')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);
      }

      setFieldDefinitions(reorderedFields);

      toast({
        title: "Fields reordered",
        description: "Field order has been updated successfully.",
      });
    } catch (err) {
      console.error('Error reordering fields:', err);
      toast({
        title: "Error",
        description: "Failed to reorder fields",
        variant: "destructive",
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchFieldDefinitions();
  }, []);

  return {
    fieldDefinitions,
    loading,
    error,
    refetch: fetchFieldDefinitions,
    createFieldDefinition,
    updateFieldDefinition,
    deleteFieldDefinition,
    reorderFieldDefinitions
  };
}