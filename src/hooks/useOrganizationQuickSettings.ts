import { useMemo } from 'react';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

interface OrganizationQuickSettings {
  show_quick_status_buttons: boolean;
}

export function useOrganizationQuickSettings() {
  const { settings, loading, refreshSettings } = useOrganizationSettings();

  const quickSettings = useMemo<OrganizationQuickSettings>(
    () => ({
      show_quick_status_buttons: settings?.show_quick_status_buttons ?? true,
    }),
    [settings?.show_quick_status_buttons]
  );

  return {
    settings: quickSettings,
    loading,
    refetch: refreshSettings,
  };
}
