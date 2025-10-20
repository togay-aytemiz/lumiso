import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnPreference } from "./ColumnSettingsButton";
import type {
  AdvancedTableColumn,
  ColumnCustomizationOptions,
} from "./AdvancedDataTable";

export function initializePreferences<T>(
  columns: AdvancedTableColumn<T>[],
  defaults?: ColumnPreference[]
): ColumnPreference[] {
  if (defaults?.length) {
    return defaults;
  }

  return columns.map((column, index) => ({
    id: column.id,
    visible: column.defaultVisible ?? column.hideable !== false,
    order: index,
  }));
}

interface UseColumnPreferencesResult<T> {
  columnPreferences: ColumnPreference[];
  setColumnPreferences: (next: ColumnPreference[]) => void;
  visibleColumns: AdvancedTableColumn<T>[];
}

export function useColumnPreferences<T>(
  columns: AdvancedTableColumn<T>[],
  options?: ColumnCustomizationOptions
): UseColumnPreferencesResult<T> {
  const defaultPreferences = useMemo(
    () => initializePreferences(columns, options?.defaultState),
    [columns, options?.defaultState]
  );

  const hydratedFromStorageRef = useRef(false);

  let storedPreferences: ColumnPreference[] | null = null;
  if (!hydratedFromStorageRef.current && options?.storageKey && typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(options.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as ColumnPreference[];
        if (Array.isArray(parsed) && parsed.length) {
          storedPreferences = parsed;
        }
      }
    } catch (error) {
      console.warn("Failed to read column preferences from storage", error);
    }
  }

  const [columnPreferences, setColumnPreferences] = useState<ColumnPreference[]>(() => {
    if (storedPreferences) {
      hydratedFromStorageRef.current = true;
      return storedPreferences;
    }
    return defaultPreferences;
  });

  useEffect(() => {
    setColumnPreferences((prev) => {
      const prefMap = new Map(prev.map((pref) => [pref.id, pref]));
      const next = columns.map((column, index) => {
        const existing = prefMap.get(column.id);
        return {
          id: column.id,
          visible:
            existing?.visible ??
            column.defaultVisible ??
            column.hideable !== false,
          order: existing?.order ?? index,
        };
      });
      return next;
    });
  }, [columns]);

  useEffect(() => {
    if (hydratedFromStorageRef.current) {
      return;
    }
    if (!options?.defaultState || options.defaultState.length === 0) {
      return;
    }
    setColumnPreferences(initializePreferences(columns, options.defaultState));
    hydratedFromStorageRef.current = true;
  }, [columns, options?.defaultState]);

  useEffect(() => {
    if (!options?.storageKey || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        options.storageKey,
        JSON.stringify(columnPreferences)
      );
    } catch (error) {
      console.warn("Failed to write column preferences to storage", error);
    }
  }, [columnPreferences, options?.storageKey]);

  useEffect(() => {
    if (options?.onChange) {
      options.onChange(columnPreferences);
    }
  }, [columnPreferences, options?.onChange]);

  const visibleColumns = useMemo(() => {
    const columnMap = new Map(columns.map((column) => [column.id, column]));

    const resolved = columnPreferences
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((pref) => columnMap.get(pref.id))
      .filter((column): column is AdvancedTableColumn<T> => Boolean(column))
      .filter((column) => {
        const pref = columnPreferences.find((p) => p.id === column.id);
        if (!pref) return column.defaultVisible ?? column.hideable !== false;
        if (column.hideable === false) return true;
        return pref.visible;
      });

    if (resolved.length === 0 && columns.length > 0) {
      return columns;
    }

    return resolved;
  }, [columns, columnPreferences]);

  return {
    columnPreferences,
    setColumnPreferences,
    visibleColumns,
  };
}
