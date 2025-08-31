import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface OrganizationSettings {
  id?: string;
  organization_id?: string;
  photography_business_name?: string | null;
  logo_url?: string | null;
  primary_brand_color?: string | null;
  date_format?: string | null;
  time_format?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const useOrganizationSettings = () => {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  // Fetch organization settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization ID using the function
      const { data: organizationId, error: orgError } = await supabase.rpc('get_user_organization_id');
      if (orgError || !organizationId) {
        setSettings(null);
        return;
      }

      // Ensure organization settings exist first
      await supabase.rpc('ensure_organization_settings', { org_id: organizationId });

      // Get organization settings
      const { data: orgSettings, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;

      setSettings(orgSettings);
    } catch (error) {
      console.error('Error fetching organization settings:', error);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  // Update organization settings
  const updateSettings = async (updates: Partial<OrganizationSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization ID using the function
      const { data: organizationId, error: orgError } = await supabase.rpc('get_user_organization_id');
      if (orgError || !organizationId) {
        throw new Error('No active organization found');
      }

      let result;
      if (settings?.id) {
        // Update existing settings
        result = await supabase
          .from('organization_settings')
          .update(updates)
          .eq('id', settings.id)
          .select()
          .single();
      } else {
        // Create new settings
        result = await supabase
          .from('organization_settings')
          .insert({
            organization_id: organizationId,
            ...updates
          })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setSettings(result.data);
      return { success: true, data: result.data };
    } catch (error: any) {
      console.error('Error updating organization settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  // Upload logo
  const uploadLogo = async (file: File) => {
    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user's active organization ID using the function
      const { data: organizationId, error: orgError } = await supabase.rpc('get_user_organization_id');
      if (orgError || !organizationId) {
        throw new Error('No active organization found');
      }

      // Delete existing logo if it exists
      if (settings?.logo_url) {
        const urlParts = settings.logo_url.split('/');
        const oldPath = urlParts.slice(-2).join('/'); // Get organizationId/filename format
        if (oldPath && oldPath.includes(organizationId)) {
          await supabase.storage.from('business-assets').remove([oldPath]);
        }
      }

      // Upload new logo with organization folder structure
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${organizationId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(filePath);

      // Update settings with new logo URL
      const updateResult = await updateSettings({ logo_url: publicUrl });
      
      if (updateResult.success) {
        toast({
          title: "Success",
          description: "Logo uploaded successfully",
        });
      }

      return updateResult;
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo",
        variant: "destructive",
      });
      return { success: false, error };
    } finally {
      setUploading(false);
    }
  };

  // Delete logo
  const deleteLogo = async () => {
    try {
      if (!settings?.logo_url) return { success: true };

      // Delete from storage
      const urlParts = settings.logo_url.split('/');
      const oldPath = urlParts.slice(-2).join('/'); // Get organizationId/filename format
      if (oldPath) {
        await supabase.storage.from('business-assets').remove([oldPath]);
      }

      // Clear the logo URL in settings
      const result = await updateSettings({ logo_url: null });
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Logo removed successfully",
        });
      }

      return result;
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete logo",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    uploading,
    updateSettings,
    uploadLogo,
    deleteLogo,
    refreshSettings: fetchSettings
  };
};