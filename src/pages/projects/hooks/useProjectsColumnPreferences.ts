import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ColumnPreference } from "@/components/data-table";

const PROJECTS_LIST_TABLE = "projects_list";
const PROJECTS_ARCHIVED_TABLE = "projects_archived";

type NullablePrefs = ColumnPreference[] | undefined;

interface ProjectsColumnPreferencesResult {
  listDefaultPreferences: NullablePrefs;
  archivedDefaultPreferences: NullablePrefs;
  saveListPreferences: (prefs: ColumnPreference[]) => Promise<void>;
  saveArchivedPreferences: (prefs: ColumnPreference[]) => Promise<void>;
  loading: boolean;
}

export function useProjectsColumnPreferences(): ProjectsColumnPreferencesResult {
  const [listDefaultPreferences, setListDefaultPreferences] =
    useState<NullablePrefs>();
  const [archivedDefaultPreferences, setArchivedDefaultPreferences] =
    useState<NullablePrefs>();
  const [loading, setLoading] = useState(true);
  const lastSavedRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        const userId = user.user?.id;
        if (!userId) {
          if (mounted) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_column_preferences")
          .select("table_name, column_config")
          .eq("user_id", userId)
          .in("table_name", [PROJECTS_LIST_TABLE, PROJECTS_ARCHIVED_TABLE]);

        if (error) throw error;

        if (!mounted || !Array.isArray(data)) {
          setLoading(false);
          return;
        }

        for (const row of data) {
          if (row.table_name === PROJECTS_LIST_TABLE && row.column_config) {
            setListDefaultPreferences(row.column_config as ColumnPreference[]);
            lastSavedRef.current[PROJECTS_LIST_TABLE] = JSON.stringify(
              row.column_config
            );
          }
          if (row.table_name === PROJECTS_ARCHIVED_TABLE && row.column_config) {
            setArchivedDefaultPreferences(row.column_config as ColumnPreference[]);
            lastSavedRef.current[PROJECTS_ARCHIVED_TABLE] = JSON.stringify(
              row.column_config
            );
          }
        }
      } catch (err) {
        console.warn("Failed to load projects column preferences", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const savePreferences = useCallback(
    async (table: string, prefs: ColumnPreference[]) => {
      try {
        const serialized = JSON.stringify(prefs);
        if (lastSavedRef.current[table] === serialized) {
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
              table_name: table,
              column_config: prefs,
            },
            { onConflict: "user_id,table_name" }
          );
        lastSavedRef.current[table] = serialized;

        if (table === PROJECTS_LIST_TABLE) {
          setListDefaultPreferences(prefs);
        } else if (table === PROJECTS_ARCHIVED_TABLE) {
          setArchivedDefaultPreferences(prefs);
        }
      } catch (err) {
        console.warn("Failed to save projects column preferences", err);
      }
    },
    []
  );

  const saveListPreferences = useCallback(
    (prefs: ColumnPreference[]) => savePreferences(PROJECTS_LIST_TABLE, prefs),
    [savePreferences]
  );

  const saveArchivedPreferences = useCallback(
    (prefs: ColumnPreference[]) =>
      savePreferences(PROJECTS_ARCHIVED_TABLE, prefs),
    [savePreferences]
  );

  return {
    listDefaultPreferences,
    archivedDefaultPreferences,
    saveListPreferences,
    saveArchivedPreferences,
    loading,
  };
}
