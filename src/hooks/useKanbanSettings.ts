import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from '@/hooks/use-toast';

export interface KanbanSettings {
  kanban_show_project_type: boolean;
  kanban_show_todo_progress: boolean;
  kanban_show_session_count: boolean;
  kanban_show_service_count: boolean;
  kanban_show_project_name: boolean;
  kanban_show_client_name: boolean;
}

export function useKanbanSettings() {
  const { activeOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['kanban_settings', activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      
      const { data, error } = await supabase
        .from('organization_settings')
        .select(`
          kanban_show_project_type,
          kanban_show_assignees,
          kanban_show_todo_progress,
          kanban_show_session_count,
          kanban_show_service_count,
          kanban_show_project_name,
          kanban_show_client_name
        `)
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();

      if (error) throw error;
      
      // Return default settings if no data found
      return data || {
      kanban_show_project_type: true,
      kanban_show_todo_progress: true,
      kanban_show_session_count: true,
      kanban_show_service_count: true,
      kanban_show_project_name: true,
      kanban_show_client_name: true,
      };
    },
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<KanbanSettings>) => {
      if (!activeOrganizationId) throw new Error('No active organization');

      const { error } = await supabase
        .from('organization_settings')
        .update(newSettings)
        .eq('organization_id', activeOrganizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban_settings', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organization_settings', activeOrganizationId] });
    },
    onError: (error) => {
      console.error('Error updating kanban settings:', error);
      toast({
        title: "Error",
        description: "Failed to update kanban settings",
        variant: "destructive",
      });
    },
  });

  const updateSettings = (newSettings: Partial<KanbanSettings>) => {
    updateSettingsMutation.mutate(newSettings);
  };

  return {
    settings: settings || {
    kanban_show_project_type: true,
    kanban_show_todo_progress: true,
    kanban_show_session_count: true,
    kanban_show_service_count: true,
    kanban_show_project_name: true,
    kanban_show_client_name: true,
    },
    isLoading,
    updateSettings,
    isUpdating: updateSettingsMutation.isPending,
  };
}