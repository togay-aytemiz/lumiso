import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface NotificationSettings {
  globalEnabled: boolean;
  scheduledTime: string;
  dailySummaryEnabled: boolean;
  projectMilestoneEnabled: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  globalEnabled: true,
  scheduledTime: "09:00",
  dailySummaryEnabled: true,
  projectMilestoneEnabled: false,
};

const notificationSettingsQueryKey = (userId?: string | null) =>
  ["notification_settings", userId];

const DB_FIELD_MAP: Record<keyof NotificationSettings, string> = {
  globalEnabled: "notification_global_enabled",
  scheduledTime: "notification_scheduled_time",
  dailySummaryEnabled: "notification_daily_summary_enabled",
  projectMilestoneEnabled: "notification_project_milestone_enabled",
};

const mapFromDb = (row: Record<string, unknown>): NotificationSettings => ({
  globalEnabled:
    typeof row.notification_global_enabled === "boolean"
      ? row.notification_global_enabled
      : DEFAULT_NOTIFICATION_SETTINGS.globalEnabled,
  scheduledTime:
    typeof row.notification_scheduled_time === "string"
      ? row.notification_scheduled_time
      : DEFAULT_NOTIFICATION_SETTINGS.scheduledTime,
  dailySummaryEnabled:
    typeof row.notification_daily_summary_enabled === "boolean"
      ? row.notification_daily_summary_enabled
      : DEFAULT_NOTIFICATION_SETTINGS.dailySummaryEnabled,
  projectMilestoneEnabled:
    typeof row.notification_project_milestone_enabled === "boolean"
      ? row.notification_project_milestone_enabled
      : DEFAULT_NOTIFICATION_SETTINGS.projectMilestoneEnabled,
});

export function useNotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: notificationSettingsQueryKey(userId),
    queryFn: async () => {
      if (!userId) {
        return DEFAULT_NOTIFICATION_SETTINGS;
      }

      const { data, error } = await supabase
        .from("user_settings")
        .select(
          "notification_global_enabled, notification_scheduled_time, notification_daily_summary_enabled, notification_project_milestone_enabled"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Failed to load notification settings:", error);
        throw error;
      }

      if (!data) {
        return DEFAULT_NOTIFICATION_SETTINGS;
      }

      return mapFromDb(data);
    },
    enabled: !!userId,
    initialData: DEFAULT_NOTIFICATION_SETTINGS,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const updateSettings = useCallback(
    async (updates: Partial<NotificationSettings>) => {
      if (!userId) {
        throw new Error("No authenticated user");
      }

      const dbUpdates = Object.entries(updates).reduce<Record<string, unknown>>(
        (acc, [key, value]) => {
          const mapped = DB_FIELD_MAP[key as keyof NotificationSettings];
          if (mapped) {
            acc[mapped] = value;
          }
          return acc;
        },
        {}
      );

      if (Object.keys(dbUpdates).length === 0) {
        return;
      }

      const { error } = await supabase
        .from("user_settings")
        .update(dbUpdates)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      queryClient.setQueryData<NotificationSettings>(
        notificationSettingsQueryKey(userId),
        (prev = DEFAULT_NOTIFICATION_SETTINGS) => ({
          ...prev,
          ...updates,
        })
      );
    },
    [queryClient, userId]
  );

  return {
    settings: query.data ?? DEFAULT_NOTIFICATION_SETTINGS,
    loading: query.isLoading && !query.isFetched,
    refetch: query.refetch,
    updateSettings,
  };
}
