import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { detectBrowserTimezone } from "@/lib/dateFormatUtils";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  fetchOrganizationSettingsWithCache,
  getOrganizationSettingsFromCache,
  setOrganizationSettingsCache,
  CachedOrganizationSettings,
  DEFAULT_ORGANIZATION_TAX_PROFILE,
  OrganizationTaxProfile,
  ORGANIZATION_SETTINGS_CACHE_TTL,
} from "@/lib/organizationSettingsCache";

export interface SocialChannel {
  name: string;
  url: string;
  platform:
    | "website"
    | "facebook"
    | "instagram"
    | "twitter"
    | "linkedin"
    | "youtube"
    | "tiktok"
    | "custom";
  customPlatformName?: string;
  enabled: boolean;
  icon?: string;
  order: number;
}

export interface OrganizationSettings extends CachedOrganizationSettings {
  socialChannels?: Record<string, SocialChannel>;
  taxProfile?: OrganizationTaxProfile;
}

const DEFAULT_SOCIAL_CHANNELS: Record<string, SocialChannel> = {};
const normalizeSettings = (
  settings: CachedOrganizationSettings | null
): OrganizationSettings | null => {
  if (!settings) return null;
  const socialChannels =
    (settings.social_channels as Record<string, SocialChannel> | null) ||
    DEFAULT_SOCIAL_CHANNELS;
  const rawProfile = settings.tax_profile as OrganizationTaxProfile | null;
  const taxProfile: OrganizationTaxProfile = {
    ...DEFAULT_ORGANIZATION_TAX_PROFILE,
    ...(rawProfile ?? {}),
    companyName:
      rawProfile?.companyName ??
      settings.photography_business_name ??
      DEFAULT_ORGANIZATION_TAX_PROFILE.companyName,
  };

  return {
    ...settings,
    socialChannels,
    taxProfile,
  };
};

export const useOrganizationSettings = () => {
  const { activeOrganizationId } = useOrganization();
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cachedSnapshot = useMemo(
    () =>
      activeOrganizationId
        ? getOrganizationSettingsFromCache(activeOrganizationId)
        : null,
    [activeOrganizationId]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["organization_settings", activeOrganizationId],
    queryFn: async () => {
      if (!activeOrganizationId) return null;
      const detectedTimezone =
        typeof window !== "undefined" ? detectBrowserTimezone() : undefined;
      return fetchOrganizationSettingsWithCache(activeOrganizationId, {
        detectedTimezone,
      });
    },
    enabled: !!activeOrganizationId,
    staleTime: ORGANIZATION_SETTINGS_CACHE_TTL,
    initialData: cachedSnapshot ?? undefined,
    refetchInterval: 90 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const settings = useMemo(() => normalizeSettings(data), [data]);

  const updateSettings = useCallback(
    async (updates: Partial<OrganizationSettings>) => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("User not authenticated");
        if (!activeOrganizationId) {
          throw new Error("No active organization found");
        }

        const { socialChannels, taxProfile, ...otherUpdates } = updates;
        const dbUpdates: Record<string, unknown> = { ...otherUpdates };
        if (socialChannels) {
          dbUpdates.social_channels = socialChannels;
        }
        if (taxProfile) {
          dbUpdates.tax_profile = taxProfile;
        } else if (updates.taxProfile === null) {
          dbUpdates.tax_profile = null;
        }

        let result;
        if (settings?.id) {
          result = await supabase
            .from("organization_settings")
            .update(dbUpdates)
            .eq("id", settings.id)
            .select("*")
            .single();
        } else {
          result = await supabase
            .from("organization_settings")
            .upsert(
              {
                organization_id: activeOrganizationId,
                ...dbUpdates,
              },
              { onConflict: "organization_id" }
            )
            .select("*")
            .single();
        }

        if (result.error) throw result.error;

        const updated = result.data as CachedOrganizationSettings;
        setOrganizationSettingsCache(activeOrganizationId, updated);
        queryClient.setQueryData(
          ["organization_settings", activeOrganizationId],
          updated
        );

        return { success: true, data: normalizeSettings(updated) };
      } catch (error: unknown) {
        console.error("Error updating organization settings:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update settings";
        const normalizedError =
          error instanceof Error ? error : new Error(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return { success: false, error: normalizedError };
      }
    },
    [activeOrganizationId, queryClient, settings?.id, toast]
  );

  const refreshSettings = useCallback(async () => {
    if (!activeOrganizationId) return;
    const detectedTimezone =
      typeof window !== "undefined" ? detectBrowserTimezone() : undefined;
    const latest = await fetchOrganizationSettingsWithCache(
      activeOrganizationId,
      { force: true, detectedTimezone }
    );
    setOrganizationSettingsCache(activeOrganizationId, latest);
    queryClient.setQueryData(
      ["organization_settings", activeOrganizationId],
      latest
    );
  }, [activeOrganizationId, queryClient]);

  const uploadLogo = useCallback(
    async (file: File) => {
      if (!activeOrganizationId) {
        const error = new Error("No active organization found");
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
        return { success: false, error };
      }

      try {
        setUploading(true);

        if (!file.type.startsWith("image/")) {
          throw new Error("File must be an image");
        }

        if (file.size > 2 * 1024 * 1024) {
          throw new Error("File size must be less than 2MB");
        }

        if (settings?.logo_url) {
          const urlParts = settings.logo_url.split("/");
          const oldPath = urlParts.slice(-2).join("/");
          if (oldPath) {
            try {
              await supabase.storage
                .from("business-assets")
                .remove([oldPath]);
            } catch (removeError) {
              console.warn(
                "Failed to remove old logo before uploading new one:",
                removeError
              );
            }
          }
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `${activeOrganizationId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("business-assets")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("business-assets").getPublicUrl(filePath);

        const result = await updateSettings({ logo_url: publicUrl });

        if (result.success) {
          toast({
            title: "Success",
            description: "Logo uploaded successfully",
          });
        }

        return result;
      } catch (error: unknown) {
        console.error("Error uploading logo:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Failed to upload logo";
        const normalizedError =
          error instanceof Error ? error : new Error(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return { success: false, error: normalizedError };
      } finally {
        setUploading(false);
      }
    },
    [activeOrganizationId, settings?.logo_url, toast, updateSettings]
  );

  const deleteLogo = useCallback(async () => {
    if (!settings?.logo_url) {
      return { success: true };
    }

    if (!activeOrganizationId) {
      const error = new Error("No active organization found");
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return { success: false, error };
    }

    try {
      const urlParts = settings.logo_url.split("/");
      const oldPath = urlParts.slice(-2).join("/");
      if (oldPath) {
        await supabase.storage.from("business-assets").remove([oldPath]);
      }

      const result = await updateSettings({ logo_url: null });

      if (result.success) {
        toast({
          title: "Success",
          description: "Logo removed successfully",
        });
      }

      return result;
    } catch (error: unknown) {
      console.error("Error deleting logo:", error);
      const message =
        error instanceof Error ? error.message : "Failed to delete logo";
      const normalizedError =
        error instanceof Error ? error : new Error(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return { success: false, error: normalizedError };
    }
  }, [activeOrganizationId, settings?.logo_url, toast, updateSettings]);

  return {
    settings,
    loading: isLoading,
    uploading,
    updateSettings,
    uploadLogo,
    deleteLogo,
    refreshSettings,
  };
};
