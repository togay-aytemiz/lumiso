import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeadFieldDefinition } from "@/types/leadFields";
import type { AdvancedTableColumn } from "@/components/data-table";
import type { Column } from "@/hooks/useDataTable";
import { CustomFieldDisplay } from "@/components/fields/CustomFieldDisplay";
import { LeadStatusBadge } from "@/components/LeadStatusBadge";
import { formatDate } from "@/lib/utils";
import { useTranslation } from "react-i18next";

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

export interface LeadWithCustomFields {
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

const parseBooleanLike = (value: string | null | undefined): boolean | null => {
  if (value == null) return null;
  const normalized = value.toString().trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

export function useLeadTableColumns(options: LeadTableColumnsOptions = {}) {
  const { t } = useTranslation("forms");
  const [fieldDefinitions, setFieldDefinitions] = useState<LeadFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const { leadStatuses, leadStatusesLoading } = options;

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data: fields, error } = await supabase
          .from("lead_field_definitions")
          .select("*")
          .order("sort_order", { ascending: true });

        if (error) throw error;
        if (active) {
          setFieldDefinitions((fields || []) as LeadFieldDefinition[]);
        }
      } catch (error) {
        console.error("Error fetching table column data:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const fieldDefinitionMap = useMemo(() => {
    const map = new Map<string, LeadFieldDefinition>();
    fieldDefinitions.forEach((definition) => {
      map.set(definition.field_key, definition);
    });
    return map;
  }, [fieldDefinitions]);

  const advancedColumns = useMemo<AdvancedTableColumn<LeadWithCustomFields>[]>(() => {
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
  }, [fieldDefinitionMap, fieldDefinitions, leadStatuses, leadStatusesLoading, t]);

  const columns = useMemo<Column<LeadWithCustomFields>[]>(() => {
    return advancedColumns.map((column) => ({
      key: column.id,
      header:
        typeof column.label === "string"
          ? column.label
          : String(column.label),
      sortable: column.sortable,
      accessor: column.accessor as ((lead: LeadWithCustomFields) => unknown) | undefined,
      render: column.render
        ? (lead: LeadWithCustomFields) => column.render?.(lead)
        : undefined,
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
              return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
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

  return {
    columns,
    advancedColumns,
    fieldDefinitions,
    sortAccessors,
    loading,
  };
}
