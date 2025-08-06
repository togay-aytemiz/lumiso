import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserSettings {
  show_quick_status_buttons: boolean;
}

const defaultSettings: UserSettings = {
  show_quick_status_buttons: true
};

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('show_quick_status_buttons')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          show_quick_status_buttons: data.show_quick_status_buttons
        });
      }
    } catch (error: any) {
      console.error('Error fetching user settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    refetch: fetchSettings
  };
}