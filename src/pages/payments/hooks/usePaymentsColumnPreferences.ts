import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ColumnPreference } from "@/components/data-table";

interface UsePaymentsColumnPreferencesResult {
  defaultPreferences: ColumnPreference[] | undefined;
  savePreferences: (prefs: ColumnPreference[]) => Promise<void>;
  loading: boolean;
}

/**
 * Loads/saves AdvancedDataTable column preferences for the payments table
 * into the shared `user_column_preferences` table (keyed by `table_name`).
 */
export function usePaymentsColumnPreferences(): UsePaymentsColumnPreferencesResult {
  const [defaultPreferences, setDefaultPreferences] = useState<ColumnPreference[]>();
  const [loading, setLoading] = useState(true);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        const userId = user.user?.id;
        if (!userId) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("user_column_preferences")
          .select("column_config")
          .eq("user_id", userId)
          .eq("table_name", "payments")
          .maybeSingle();
        if (error) throw error;
        if (mounted && data?.column_config) {
          setDefaultPreferences(data.column_config as ColumnPreference[]);
          lastSavedRef.current = JSON.stringify(data.column_config);
        }
      } catch (err) {
        console.warn("Failed to load payments column preferences", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const savePreferences = useCallback(async (prefs: ColumnPreference[]) => {
    try {
      const serialized = JSON.stringify(prefs);
      if (lastSavedRef.current === serialized) {
        return;
      }
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId) return;
      await supabase
        .from("user_column_preferences")
        .upsert(
          {
            user_id: userId,
            table_name: "payments",
            column_config: prefs,
          },
          { onConflict: "user_id,table_name" }
        );
      lastSavedRef.current = serialized;
    } catch (err) {
      console.warn("Failed to save payments column preferences", err);
    }
  }, []);

  return { defaultPreferences, savePreferences, loading };
}
