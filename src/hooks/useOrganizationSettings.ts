import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { detectBrowserTimezone } from '@/lib/dateFormatUtils';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface SocialChannel {
  name: string;
  url: string;
  platform:
    | 'website'
    | 'facebook'
    | 'instagram'
    | 'twitter'
    | 'linkedin'
    | 'youtube'
    | 'tiktok'
    | 'custom';
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
  social_channels?: Record<string, SocialChannel> | null;
  socialChannels?: Record<string, SocialChannel>;
  created_at?: string;
  updated_at?: string;
}

type OrganizationSettingsRow = OrganizationSettings & {
  social_channels?: Record<string, SocialChannel> | null;
};

const fetchOrganizationSettings = async (
  organizationId: string
): Promise<OrganizationSettingsRow | null> => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('User not authenticated');

  const { data: existingSettings, error: fetchError } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existingSettings) {
    return existingSettings as OrganizationSettingsRow;
  }

  const detectedTimezone = detectBrowserTimezone();
  await supabase.rpc('ensure_organization_settings', {
    org_id: organizationId,
    detected_timezone: detectedTimezone,
  });

  if (user.email) {
    await supabase
      .from('organization_settings')
      .update({ email: user.email })
      .eq('organization_id', organizationId);
  }

  const { data: ensuredSettings, error: ensuredError } = await supabase
    .from('organization_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (ensuredError) throw ensuredError;
  if (ensuredSettings) {
    return ensuredSettings as OrganizationSettingsRow;
  }

  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('photography_business_name, logo_url, primary_brand_color, date_format')
    .eq('user_id', user.id)
    .maybeSingle();

  if (userSettings) {
    return {
      organization_id: organizationId,
      social_channels: {},
      ...userSettings,
    } as OrganizationSettingsRow;
  }

  return null;
};

export const useOrganizationSettings = () => {
  const { activeOrganizationId } = useOrganization();
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['organization_settings', activeOrganizationId],
    queryFn: () => fetchOrganizationSettings(activeOrganizationId!),
    enabled: !!activeOrganizationId,
    staleTime: 5 * 60 * 1000,
  });

  const settings = useMemo<OrganizationSettings | null>(() => {
    if (!data) return null;
    return {
      ...data,
      socialChannels:
        (data.social_channels as Record<string, SocialChannel> | null) || {},
    };
  }, [data]);

  const updateSettings = useCallback(
    async (updates: Partial<OrganizationSettings>) => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('User not authenticated');
        if (!activeOrganizationId) {
          throw new Error('No active organization found');
        }

        const { socialChannels, ...otherUpdates } = updates;
        const dbUpdates: Record<string, unknown> = { ...otherUpdates };

        if (socialChannels) {
          dbUpdates.social_channels = socialChannels;
        }

        let result;
        if (settings?.id) {
          result = await supabase
            .from('organization_settings')
            .update(dbUpdates)
            .eq('id', settings.id)
            .select('*')
            .single();
        } else {
          result = await supabase
            .from('organization_settings')
            .upsert(
              {
                organization_id: activeOrganizationId,
                ...dbUpdates,
              },
              { onConflict: 'organization_id' }
            )
            .select('*')
            .single();
        }

        if (result.error) throw result.error;

        queryClient.setQueryData(
          ['organization_settings', activeOrganizationId],
          result.data
        );

        return { success: true, data: result.data as OrganizationSettings };
      } catch (error: any) {
        console.error('Error updating organization settings:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to update settings',
          variant: 'destructive',
        });
        return { success: false, error };
      }
    },
    [activeOrganizationId, queryClient, settings?.id, toast]
  );

  const uploadLogo = useCallback(
    async (file: File) => {
      if (!activeOrganizationId) {
        const error = new Error('No active organization found');
        return { success: false, error };
      }

      try {
        setUploading(true);
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('User not authenticated');

        if (!file.type.startsWith('image/')) {
          throw new Error('File must be an image');
        }

        if (file.size > 2 * 1024 * 1024) {
          throw new Error('File size must be less than 2MB');
        }

        if (settings?.logo_url) {
          const urlParts = settings.logo_url.split('/');
          const oldPath = urlParts.slice(-2).join('/');
          if (oldPath) {
            try {
              await supabase.storage
                .from('business-assets')
                .remove([oldPath]);
            } catch (removeError) {
              console.warn(
                'Failed to remove old logo before uploading new one:',
                removeError
              );
            }
          }
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `${activeOrganizationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('business-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage
          .from('business-assets')
          .getPublicUrl(filePath);

        const updateResult = await updateSettings({ logo_url: publicUrl });

        if (updateResult.success) {
          toast({
            title: 'Success',
            description: 'Logo uploaded successfully',
          });
        }

        return updateResult;
      } catch (error: any) {
        console.error('Error uploading logo:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to upload logo',
          variant: 'destructive',
        });
        return { success: false, error };
      } finally {
        setUploading(false);
      }
    },
    [activeOrganizationId, settings?.logo_url, toast, updateSettings]
  );

  const deleteLogo = useCallback(async () => {
    if (!settings?.logo_url) return { success: true };
    if (!activeOrganizationId) {
      const error = new Error('No active organization found');
      return { success: false, error };
    }

    try {
      const urlParts = settings.logo_url.split('/');
      const oldPath = urlParts.slice(-2).join('/');
      if (oldPath) {
        await supabase.storage.from('business-assets').remove([oldPath]);
      }

      const result = await updateSettings({ logo_url: null });

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Logo removed successfully',
        });
      }

      return result;
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete logo',
        variant: 'destructive',
      });
      return { success: false, error };
    }
  }, [activeOrganizationId, settings?.logo_url, toast, updateSettings]);

  return {
    settings,
    loading: isLoading,
    uploading,
    updateSettings,
    uploadLogo,
    deleteLogo,
    refreshSettings: refetch,
  };
};
