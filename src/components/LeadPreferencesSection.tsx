import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function LeadPreferencesSection() {
  const [settings, setSettings] = useState({
    show_quick_status_buttons: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemStatuses, setSystemStatuses] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
    fetchSystemStatuses();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

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
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to load preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStatuses = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('lead_statuses')
        .select('name, is_system_final')
        .eq('user_id', userData.user.id)
        .eq('is_system_final', true)
        .order('sort_order');

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSystemStatuses(data);
      }
    } catch (error: any) {
      console.error('Error fetching system statuses:', error);
    }
  };

  const updateSetting = async (key: keyof typeof settings, value: boolean) => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userData.user.id,
          [key]: value
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));

      toast({
        title: "Success",
        description: "Preferences updated"
      });
    } catch (error: any) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Add a function to refetch system statuses when needed
  const refreshSystemStatuses = () => {
    fetchSystemStatuses();
  };

  // Listen for storage events to refresh when statuses are updated
  useEffect(() => {
    const handleStorageChange = () => {
      fetchSystemStatuses();
    };

    // Check for updates periodically or on window focus
    window.addEventListener('focus', handleStorageChange);
    
    return () => {
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead Preferences</CardTitle>
          <CardDescription>Configure lead management options</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Preferences</CardTitle>
        <CardDescription>Configure lead management options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="quick-status-buttons" className="text-base">
              Show quick status buttons on lead details
            </Label>
            <p className="text-sm text-muted-foreground">
              {systemStatuses.length >= 2 ? (
                `Display "${systemStatuses[0]?.name}" and "${systemStatuses[1]?.name}" buttons on lead detail pages and related dropdowns`
              ) : systemStatuses.length === 1 ? (
                `Display "${systemStatuses[0]?.name}" button on lead detail pages and related dropdowns`
              ) : (
                "Display quick action buttons on lead detail pages and related dropdowns"
              )}
            </p>
          </div>
          <Switch
            id="quick-status-buttons"
            checked={settings.show_quick_status_buttons}
            onCheckedChange={(checked) => updateSetting('show_quick_status_buttons', checked)}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}