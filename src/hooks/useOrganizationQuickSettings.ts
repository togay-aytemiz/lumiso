import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserOrganizationId } from '@/lib/organizationUtils';

interface OrganizationQuickSettings {
  show_quick_status_buttons: boolean;
}

export function useOrganizationQuickSettings() {
  const [settings, setSettings] = useState<OrganizationQuickSettings>({
    show_quick_status_buttons: true
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get organization settings instead of user settings
      const organizationId = await getUserOrganizationId();
      if (!organizationId) return;

      // Ensure organization settings exist
      await supabase.rpc('ensure_organization_settings', { org_id: organizationId });

      const { data, error } = await supabase
        .from('organization_settings')
        .select('show_quick_status_buttons')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          show_quick_status_buttons: data.show_quick_status_buttons ?? true
        });
      }
    } catch (error: any) {
      console.error('Error fetching organization quick settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    refetch: fetchSettings
  };
}