import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeadFieldDefinition } from "@/types/leadFields";
import { Column } from "@/hooks/useDataTable";
import { CustomFieldDisplay } from "@/components/fields/CustomFieldDisplay";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { formatDate } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type {
  AdvancedTableColumn,
  ColumnPreference,
  ColumnSettingsMeta,
} from "@/components/data-table";

// System-reserved column keys that cannot be used by custom fields
const RESERVED_CORE_KEYS = new Set([
  "name",
  "email",
  "phone",
  "status",
  "updated_at",
  "created_at",
  "assignees",
  "status_id",
  "due_date",
  "notes",
]);

export const LEAD_TABLE_COLUMN_STORAGE_KEY = "leads.table.columns";

interface ColumnConfig {
  key: string;
  visible: boolean;
  order: number;
}

interface LeadStatusOption {
  id: string;
  name: string;
  color: string;
  is_system_final?: boolean;
}

interface LeadTableColumnsOptions {
  leadStatuses?: LeadStatusOption[];
  leadStatusesLoading?: boolean;
}

interface LeadWithCustomFields {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  status_id: string;
  assignees: string[];
  updated_at: string;
  created_at: string;
  due_date?: string;
  notes?: string;
  custom_fields: Record<string, string | null>;
  lead_statuses?: {
    id: string;
    name: string;
    color: string;
    is_system_final: boolean;
  };
}

const mapConfigsToPreferences = (
  configs: ColumnConfig[]
): ColumnPreference[] => {
  return configs
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((config, index) => ({
      id: config.key,
      visible: config.visible,
      order: index,
    }));
};

const mapPreferencesToConfigs = (
  preferences: ColumnPreference[]
): ColumnConfig[] => {
  return preferences.map((pref, index) => ({
    key: pref.id,
    visible: pref.visible,
    order: index + 1,
  }));
};

const parseBooleanLike = (value: string | null | undefined): boolean | null => {
  if (value == null) return null;
  const normalized = value.toString().trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

export function useLeadTableColumns(options: LeadTableColumnsOptions = {}) {
  const { t } = useTranslation("forms");
  const [fieldDefinitions, setFieldDefinitions] = useState<
    LeadFieldDefinition[]
  >([]);
  const [columnPreferences, setColumnPreferences] = useState<ColumnConfig[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const { leadStatuses, leadStatusesLoading } = options;

  // Fetch field definitions and user preferences
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch field definitions
        const { data: fields, error: fieldsError } = await supabase
          .from("lead_field_definitions")
          .select("*")
          .order("sort_order", { ascending: true });

        if (fieldsError) throw fieldsError;
        setFieldDefinitions((fields || []) as LeadFieldDefinition[]);

        // Fetch user column preferences (safely handle multiple rows)
        const { data: prefs, error: prefsError } = await supabase
          .from("user_column_preferences")
          .select("column_config, updated_at")
          .eq("table_name", "leads")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prefsError && prefsError.code !== "PGRST116") {
          // PGRST116 is "not found" error, which is expected for new users
          throw prefsError;
        }

        if (prefs?.column_config) {
          const rawPrefs = prefs.column_config as unknown as ColumnConfig[];

          // Build allowed keys: system columns + custom fields that don't collide
          const customFieldKeys = ((fields || []) as LeadFieldDefinition[])
            .map((f) => f.field_key)
            .filter((key) => !RESERVED_CORE_KEYS.has(key));

          const allowedKeys = new Set<string>([
            "name",
            "status",
            "phone",
            "email",
            "updated_at",
            ...customFieldKeys,
          ]);

          // Deduplicate and sanitize preferences
          const seen = new Set<string>();
          const sanitized = rawPrefs
            .filter((pref) => {
              // Skip invalid entries
              if (!pref || typeof pref.key !== "string") return false;

              // Skip deprecated columns like 'assignees'
              if (pref.key === "assignees") return false;

              // Skip unknown/disallowed keys
              if (!allowedKeys.has(pref.key)) return false;

              // Skip duplicates (keep first occurrence)
              if (seen.has(pref.key)) return false;

              seen.add(pref.key);
              return true;
            })
            .map((pref, index) => ({
              ...pref,
              order: typeof pref.order === "number" ? pref.order : index + 1,
              visible: !!pref.visible,
            }));

          if (sanitized.length === 0) {
            const defaultPrefs = generateDefaultColumnPreferences(
              (fields || []) as LeadFieldDefinition[]
            );
            setColumnPreferences(defaultPrefs);
          } else {
            setColumnPreferences(sanitized);
            // Persist back if changed so old users stop seeing removed columns
            const changed =
              sanitized.length !== rawPrefs.length ||
              sanitized.some((p, i) => p.key !== rawPrefs[i]?.key);
            if (changed) {
              try {
                const { data: user } = await supabase.auth.getUser();
                if (user.user?.id) {
                  await supabase.from("user_column_preferences").upsert(
                    {
                      user_id: user.user.id,
                      table_name: "leads",
                      column_config: sanitized,
                    },
                    { onConflict: "user_id,table_name" }
                  );
                }
              } catch (e) {
                console.error("Error persisting sanitized preferences:", e);
              }
            }
          }
        } else {
          // Set default preferences if none exist
          const defaultPrefs = generateDefaultColumnPreferences(
            (fields || []) as LeadFieldDefinition[]
          );
          setColumnPreferences(defaultPrefs);
        }
      } catch (error) {
        console.error("Error fetching table column data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Generate default column preferences
  const generateDefaultColumnPreferences = (
    fields: LeadFieldDefinition[]
  ): ColumnConfig[] => {
    const defaultColumns: ColumnConfig[] = [
      // Default order: Name, Status, Phone Number, Email address, Last Updated
      { key: "name", visible: true, order: 1 },
      { key: "status", visible: true, order: 2 },
      { key: "phone", visible: true, order: 3 },
      { key: "email", visible: true, order: 4 },
      { key: "updated_at", visible: true, order: 5 },
    ];

    // Add custom fields that are visible in table and don't collide with system keys
    const customFieldColumns = fields
      .filter(
        (field) =>
          field.is_visible_in_table && !RESERVED_CORE_KEYS.has(field.field_key)
      )
      .map((field, index) => ({
        key: field.field_key,
        visible: false, // Default to hidden for additional custom fields
        order: 6 + index,
      }));

    return [...defaultColumns, ...customFieldColumns];
  };

  const fieldDefinitionMap = useMemo(() => {
    const map = new Map<string, LeadFieldDefinition>();
    fieldDefinitions.forEach((definition) => {
      map.set(definition.field_key, definition);
    });
    return map;
  }, [fieldDefinitions]);

  const defaultColumnConfig = useMemo(
    () => generateDefaultColumnPreferences(fieldDefinitions),
    [fieldDefinitions]
  );

  // Generate column definitions for DataTable
  const columns = useMemo((): Column<LeadWithCustomFields>[] => {
    // Deduplicate visible preferences one last time before rendering
    const seen = new Set<string>();
    const visiblePrefs = columnPreferences
      .filter((pref) => pref.visible)
      .filter((pref) => {
        if (seen.has(pref.key)) return false;
        seen.add(pref.key);
        return true;
      })
      .sort((a, b) => a.order - b.order);

    return visiblePrefs.map((pref) => {
      const fieldDef = fieldDefinitionMap.get(pref.key);

      // System columns that map to lead properties
      if (pref.key === "name") {
        const nameFieldDef = fieldDefinitionMap.get("name");
        return {
          key: "name",
          header: t("lead_table_columns.name"),
          sortable: true,
          // Always prioritize core lead.name to avoid stale values from custom fields
          accessor: (lead) => lead.name || lead.custom_fields["name"],
          render: (lead) =>
            React.createElement(
              "span",
              {
                className: "font-medium",
              },
              lead.name || lead.custom_fields["name"] || "-"
            ),
        };
      }

      if (pref.key === "email") {
        const emailFieldDef = fieldDefinitionMap.get("email");
        return {
          key: "email",
          header: t("lead_table_columns.email"),
          sortable: true,
          accessor: (lead) => lead.custom_fields["email"] || lead.email,
          render: (lead) => {
            const value = lead.custom_fields["email"] || lead.email;
            return emailFieldDef
              ? React.createElement(CustomFieldDisplay, {
                  fieldDefinition: emailFieldDef,
                  value: value,
                  tableContext: true,
                })
              : React.createElement("span", {}, value || "-");
          },
        };
      }

      if (pref.key === "phone") {
        const phoneFieldDef = fieldDefinitionMap.get("phone");
        return {
          key: "phone",
          header: t("lead_table_columns.phone"),
          sortable: true,
          accessor: (lead) => lead.custom_fields["phone"] || lead.phone,
          render: (lead) => {
            const value = lead.custom_fields["phone"] || lead.phone;
            return phoneFieldDef
              ? React.createElement(CustomFieldDisplay, {
                  fieldDefinition: phoneFieldDef,
                  value: value,
                  tableContext: true,
                })
              : React.createElement("span", {}, value || "-");
          },
        };
      }

      if (pref.key === "status") {
        return {
          key: "status",
          header: t("lead_table_columns.status"),
          sortable: true,
          render: (lead) =>
            React.createElement(LeadStatusBadge, {
              leadId: lead.id,
              currentStatusId: lead.status_id,
              currentStatus: lead.status,
              onStatusChange: () => {}, // Will be passed from parent
              editable: false,
              size: "sm",
              statuses: leadStatuses,
              statusesLoading: leadStatusesLoading,
            }),
        };
      }

      // Remove assignees column - not applicable for single photographer mode

      if (pref.key === "updated_at") {
        return {
          key: "updated_at",
          header: t("lead_table_columns.last_updated"),
          sortable: true,
          render: (lead) =>
            React.createElement(
              "span",
              {
                className: "text-sm text-muted-foreground",
              },
              formatDate(lead.updated_at)
            ),
        };
      }

      // Custom field columns (but never for reserved system keys)
      if (fieldDef && !RESERVED_CORE_KEYS.has(fieldDef.field_key)) {
        return {
          key: `custom_fields.${fieldDef.field_key}`,
          header: fieldDef.label,
          sortable: true,
          accessor: (lead) => lead.custom_fields[fieldDef.field_key],
          render: (lead) =>
            React.createElement(CustomFieldDisplay, {
              fieldDefinition: fieldDef,
              value: lead.custom_fields[fieldDef.field_key],
              tableContext: true,
            }),
        };
      }

      return {
        key: pref.key,
        header: pref.key,
        sortable: false,
        render: () => React.createElement("span", {}, "-"),
      };
    });
  }, [columnPreferences, fieldDefinitionMap, leadStatuses, leadStatusesLoading, t]);

  const advancedColumns = useMemo<
    AdvancedTableColumn<LeadWithCustomFields>[]
  >(() => {
    const emailFieldDef = fieldDefinitionMap.get("email");
    const phoneFieldDef = fieldDefinitionMap.get("phone");

    const fallbackText = (value: string | null | undefined) =>
      value && value.trim().length > 0 ? value : "-";

    const baseColumns: AdvancedTableColumn<LeadWithCustomFields>[] = [
      {
        id: "name",
        label: t("lead_table_columns.name"),
        sortable: true,
        sortId: "name",
        hideable: false,
        defaultVisible: true,
        minWidth: "220px",
        render: (lead) => {
          const value = lead.name || lead.custom_fields["name"];
          return React.createElement(
            "div",
            { className: "flex flex-col" },
            React.createElement(
              "span",
              {
                className: "font-semibold text-foreground",
              },
              fallbackText(value)
            )
          );
        },
        accessor: (lead) => lead.name || lead.custom_fields["name"] || "",
        cellClassName: "text-foreground",
      },
      {
        id: "status",
        label: t("lead_table_columns.status"),
        sortable: true,
        sortId: "status",
        hideable: false,
        defaultVisible: true,
        minWidth: "160px",
        render: (lead) =>
          React.createElement(LeadStatusBadge, {
            leadId: lead.id,
            currentStatusId: lead.status_id,
            currentStatus: lead.status,
            onStatusChange: () => {},
            editable: false,
            size: "sm",
            statuses: leadStatuses,
            statusesLoading: leadStatusesLoading,
          }),
        accessor: (lead) => lead.lead_statuses?.name || lead.status || "",
      },
      {
        id: "phone",
        label: t("lead_table_columns.phone"),
        sortable: true,
        sortId: "phone",
        hideable: true,
        defaultVisible: true,
        minWidth: "160px",
        render: (lead) => {
          const value = lead.custom_fields["phone"] || lead.phone;
          if (phoneFieldDef) {
            return React.createElement(CustomFieldDisplay, {
              fieldDefinition: phoneFieldDef,
              value,
              tableContext: true,
            });
          }
          return React.createElement(
            "span",
            {
              className: "text-sm text-foreground",
            },
            fallbackText(value)
          );
        },
        accessor: (lead) => lead.custom_fields["phone"] || lead.phone || "",
      },
      {
        id: "email",
        label: t("lead_table_columns.email"),
        sortable: true,
        sortId: "email",
        hideable: true,
        defaultVisible: true,
        minWidth: "200px",
        render: (lead) => {
          const value = lead.custom_fields["email"] || lead.email;
          if (emailFieldDef) {
            return React.createElement(CustomFieldDisplay, {
              fieldDefinition: emailFieldDef,
              value,
              tableContext: true,
            });
          }
          return React.createElement(
            "span",
            {
              className: "text-sm text-foreground",
            },
            fallbackText(value)
          );
        },
        accessor: (lead) => lead.custom_fields["email"] || lead.email || "",
      },
      {
        id: "updated_at",
        label: t("lead_table_columns.last_updated"),
        sortable: true,
        sortId: "updated_at",
        hideable: false,
        defaultVisible: true,
        minWidth: "160px",
        render: (lead) =>
          React.createElement(
            "span",
            {
              className: "text-sm text-muted-foreground",
            },
            formatDate(lead.updated_at)
          ),
        accessor: (lead) => lead.updated_at,
      },
    ];

    const customFieldColumns = fieldDefinitions
      .filter((field) => !RESERVED_CORE_KEYS.has(field.field_key))
      .map<AdvancedTableColumn<LeadWithCustomFields>>((field) => ({
        id: field.field_key,
        label: field.label,
        sortable: true,
        sortId: field.field_key,
        hideable: true,
        defaultVisible: false,
        minWidth: "180px",
        render: (lead) =>
          React.createElement(CustomFieldDisplay, {
            fieldDefinition: field,
            value: lead.custom_fields[field.field_key],
            tableContext: true,
          }),
        accessor: (lead) => lead.custom_fields[field.field_key] || "",
      }));

    return [...baseColumns, ...customFieldColumns];
  }, [
    fieldDefinitionMap,
    fieldDefinitions,
    leadStatuses,
    leadStatusesLoading,
    t,
  ]);

  const advancedDefaultPreferences = useMemo(
    () => mapConfigsToPreferences(defaultColumnConfig),
    [defaultColumnConfig]
  );

  const advancedColumnPreferences = useMemo(
    () => mapConfigsToPreferences(columnPreferences),
    [columnPreferences]
  );

  const columnSettingsMeta = useMemo<ColumnSettingsMeta[]>(() => {
    return advancedColumns.map((column) => ({
      id: column.id,
      label:
        typeof column.label === "string" ? column.label : String(column.label),
      description:
        typeof column.description === "string"
          ? column.description
          : undefined,
      hideable: column.hideable !== false,
    }));
  }, [advancedColumns]);

  const sortAccessors = useMemo<
    Record<string, (lead: LeadWithCustomFields) => string | number>
  >(() => {
    const accessors: Record<string, (lead: LeadWithCustomFields) => string | number> = {
      name: (lead) =>
        (lead.name || lead.custom_fields["name"] || "").toString().toLowerCase(),
      status: (lead) =>
        (lead.lead_statuses?.name || lead.status || "").toString().toLowerCase(),
      phone: (lead) =>
        (lead.custom_fields["phone"] || lead.phone || "").toString().toLowerCase(),
      email: (lead) =>
        (lead.custom_fields["email"] || lead.email || "").toString().toLowerCase(),
      updated_at: (lead) => {
        const timestamp = new Date(lead.updated_at).getTime();
        return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
      },
    };

    fieldDefinitions
      .filter((field) => !RESERVED_CORE_KEYS.has(field.field_key))
      .forEach((field) => {
        accessors[field.field_key] = (lead) => {
          const rawValue = lead.custom_fields[field.field_key];
          if (!rawValue) return "";

          switch (field.field_type) {
            case "number": {
              const parsed = Number(rawValue);
              return Number.isNaN(parsed)
                ? Number.NEGATIVE_INFINITY
                : parsed;
            }
            case "date": {
              const parsedDate = new Date(rawValue);
              return Number.isNaN(parsedDate.getTime())
                ? Number.NEGATIVE_INFINITY
                : parsedDate.getTime();
            }
            case "checkbox": {
              const parsed = parseBooleanLike(rawValue);
              if (parsed == null) return -1;
              return parsed ? 1 : 0;
            }
            default:
              return rawValue.toLowerCase();
          }
        };
      });

    return accessors;
  }, [fieldDefinitions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (advancedColumnPreferences.length === 0) return;
    try {
      window.localStorage.setItem(
        LEAD_TABLE_COLUMN_STORAGE_KEY,
        JSON.stringify(advancedColumnPreferences)
      );
    } catch (error) {
      console.warn("Failed to persist lead column preferences locally", error);
    }
  }, [advancedColumnPreferences]);

  // Save column preferences
  const saveColumnPreferences = async (newPreferences: ColumnConfig[]) => {
    try {
      console.log("Saving column preferences:", newPreferences);

      // Deduplicate preferences by key (keep first occurrence)
      const seen = new Set<string>();
      const deduplicatedPreferences = newPreferences.filter((pref) => {
        if (seen.has(pref.key)) {
          console.warn(
            `Duplicate column key detected and removed: ${pref.key}`
          );
          return false;
        }
        seen.add(pref.key);
        return true;
      });

      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) throw new Error("User not authenticated");

      const { error } = await supabase.from("user_column_preferences").upsert(
        {
          user_id: user.user.id,
          table_name: "leads",
          column_config: deduplicatedPreferences,
        },
        {
          onConflict: "user_id,table_name",
        }
      );

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Successfully saved preferences, updating state");
      setColumnPreferences(deduplicatedPreferences);
    } catch (error) {
      console.error("Error saving column preferences:", error);
      throw error;
    }
  };

  const saveAdvancedColumnPreferences = async (
    preferences: ColumnPreference[]
  ) => {
    await saveColumnPreferences(mapPreferencesToConfigs(preferences));
  };

  // Get available columns for configuration
  const availableColumns = useMemo(() => {
    const coreColumns = [
      { key: "name", label: t("lead_table_columns.name"), isCore: false },
      { key: "status", label: t("lead_table_columns.status"), isCore: true },
      { key: "phone", label: t("lead_table_columns.phone"), isCore: false },
      { key: "email", label: t("lead_table_columns.email"), isCore: false },
      {
        key: "updated_at",
        label: t("lead_table_columns.last_updated"),
        isCore: true,
      },
    ];

    // Only show custom fields that don't collide with reserved system keys
    const customColumns = fieldDefinitions
      .filter((field) => !RESERVED_CORE_KEYS.has(field.field_key))
      .map((field) => ({
        key: field.field_key,
        label: field.label,
        isCore: false,
        fieldDefinition: field,
      }));

    return [...coreColumns, ...customColumns];
  }, [fieldDefinitions, t]);

  // Reset to default preferences
  const resetToDefault = async () => {
    const defaultPrefs = generateDefaultColumnPreferences(fieldDefinitions);
    await saveColumnPreferences(defaultPrefs);
  };

  return {
    columns,
    advancedColumns,
    columnPreferences,
    availableColumns,
    fieldDefinitions,
    columnSettingsMeta,
    advancedColumnPreferences,
    advancedDefaultPreferences,
    sortAccessors,
    loading,
    saveColumnPreferences,
    saveAdvancedColumnPreferences,
    resetToDefault,
  };
}
