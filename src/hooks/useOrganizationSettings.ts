import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { detectBrowserTimezone } from '@/lib/dateFormatUtils';

export interface SocialChannel {
  name: string;
  url: string;
  platform: 'website' | 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok' | 'custom';
  customPlatformName?: string;
  enabled: boolean;
  icon?: string;
  order: number;
}

export interface OrganizationSettings {
  id?: string;
  organization_id?: string;
  photography_business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  primary_brand_color?: string | null;
  date_format?: string | null;
  time_format?: string | null;
  timezone?: string | null;
  social_channels?: Record<string, SocialChannel>;
  socialChannels?: Record<string, SocialChannel>;
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

      // Get user's active organization ID using utility function
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        setSettings(null);
        return;
      }

      // Check if organization settings already exist
      const { data: existingSettings } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!existingSettings) {
        // First time setup - create settings with user's email as business email
        const detectedTimezone = detectBrowserTimezone();
        await supabase.rpc('ensure_organization_settings', { 
          org_id: organizationId,
          detected_timezone: detectedTimezone
        });

        // Update the newly created settings with user's email
        await supabase
          .from('organization_settings')
          .update({ email: user.email })
          .eq('organization_id', organizationId);
      }

      // Get organization settings (after ensuring they exist)
      const { data: orgSettings, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;

      // If no org settings found, try to get from user_settings as fallback
      if (!orgSettings) {
        const { data: userSettings } = await supabase
          .from('user_settings')
          .select('photography_business_name, logo_url, primary_brand_color, date_format')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userSettings) {
          // Create minimal settings from user data
          setSettings({
            photography_business_name: userSettings.photography_business_name,
            logo_url: userSettings.logo_url,
            primary_brand_color: userSettings.primary_brand_color,
            date_format: userSettings.date_format,
            socialChannels: {}
          });
          return;
        }
      }

      // Ensure social_channels field exists with fallback
      const settingsWithDefaults = {
        ...orgSettings,
        socialChannels: (orgSettings.social_channels as any) || {}
      };

      setSettings(settingsWithDefaults as unknown as OrganizationSettings);
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

      // Get user's active organization ID using utility function
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
        throw new Error('No active organization found');
      }

      // Convert social_channels to proper format for database and separate from other updates
      const { socialChannels, ...otherUpdates } = updates;
      const dbUpdates = { ...otherUpdates } as any;
      
      if (socialChannels) {
        dbUpdates.social_channels = socialChannels;
      }

      let result;
      if (settings?.id) {
        // Update existing settings
        result = await supabase
          .from('organization_settings')
          .update(dbUpdates)
          .eq('id', settings.id)
          .select()
          .single();
      } else {
        // Create new settings
        result = await supabase
          .from('organization_settings')
          .insert({
            organization_id: organizationId,
            ...dbUpdates
          })
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Ensure social_channels field exists with fallback for returned data
      const settingsWithDefaults = {
        ...result.data,
        socialChannels: (result.data.social_channels as any) || {}
      };

      setSettings(settingsWithDefaults as unknown as OrganizationSettings);
      return { success: true, data: settingsWithDefaults as unknown as OrganizationSettings };
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

      // Get user's active organization ID using utility function
      const { getUserOrganizationId } = await import('@/lib/organizationUtils');
      const organizationId = await getUserOrganizationId();
      if (!organizationId) {
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