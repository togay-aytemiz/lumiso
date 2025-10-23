import { useCallback, useMemo, useState } from 'react';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

export interface KanbanSettings {
  kanban_show_project_type: boolean;
  kanban_show_todo_progress: boolean;
  kanban_show_session_count: boolean;
  kanban_show_service_count: boolean;
  kanban_show_project_name: boolean;
  kanban_show_client_name: boolean;
}

export function useKanbanSettings() {
  const { settings, loading, updateSettings } = useOrganizationSettings();
  const [isUpdating, setIsUpdating] = useState(false);

  const kanbanSettings = useMemo<KanbanSettings>(
    () => ({
      kanban_show_project_type:
        settings?.kanban_show_project_type ?? true,
      kanban_show_todo_progress:
        settings?.kanban_show_todo_progress ?? true,
      kanban_show_session_count:
        settings?.kanban_show_session_count ?? true,
      kanban_show_service_count:
        settings?.kanban_show_service_count ?? true,
      kanban_show_project_name:
        settings?.kanban_show_project_name ?? true,
      kanban_show_client_name:
        settings?.kanban_show_client_name ?? true,
    }),
    [
      settings?.kanban_show_client_name,
      settings?.kanban_show_project_name,
      settings?.kanban_show_project_type,
      settings?.kanban_show_service_count,
      settings?.kanban_show_session_count,
      settings?.kanban_show_todo_progress,
    ]
  );

  const handleUpdateSettings = useCallback(
    async (newSettings: Partial<KanbanSettings>) => {
      setIsUpdating(true);
      try {
        await updateSettings(newSettings);
      } finally {
        setIsUpdating(false);
      }
    },
    [updateSettings]
  );

  return {
    settings: kanbanSettings,
    isLoading: loading,
    updateSettings: handleUpdateSettings,
    isUpdating,
  };
}
