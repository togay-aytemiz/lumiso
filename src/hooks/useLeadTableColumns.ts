import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LeadFieldDefinition } from '@/types/leadFields';
import { Column } from '@/hooks/useDataTable';
import { CustomFieldDisplay } from '@/components/fields/CustomFieldDisplay';
import { LeadStatusBadge } from '@/components/LeadStatusBadge';
import { formatDate } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface ColumnConfig {
  key: string;
  visible: boolean;
  order: number;
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
  lead_statuses?: { id: string; name: string; color: string; is_system_final: boolean };
}

export function useLeadTableColumns() {
  const { t } = useTranslation('forms');
  const [fieldDefinitions, setFieldDefinitions] = useState<LeadFieldDefinition[]>([]);
  const [columnPreferences, setColumnPreferences] = useState<ColumnConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch field definitions and user preferences
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch field definitions
        const { data: fields, error: fieldsError } = await supabase
          .from('lead_field_definitions')
          .select('*')
          .order('sort_order', { ascending: true });

        if (fieldsError) throw fieldsError;
        setFieldDefinitions((fields || []) as LeadFieldDefinition[]);

        // Fetch user column preferences
        const { data: prefs, error: prefsError } = await supabase
          .from('user_column_preferences')
          .select('column_config')
          .eq('table_name', 'leads')
          .single();

        if (prefsError && prefsError.code !== 'PGRST116') {
          // PGRST116 is "not found" error, which is expected for new users
          throw prefsError;
        }

        if (prefs?.column_config) {
          const rawPrefs = (prefs.column_config as any) as ColumnConfig[];
          // Sanitize preferences: remove deprecated/unknown columns like 'assignees'
          const allowedKeys = new Set<string>([
            'name', 'status', 'phone', 'email', 'updated_at',
            ...(((fields || []) as LeadFieldDefinition[]).map(f => f.field_key))
          ]);
          const sanitized = rawPrefs
            .filter(pref => pref && typeof pref.key === 'string' && allowedKeys.has(pref.key) && pref.key !== 'assignees')
            .map((pref, index) => ({
              ...pref,
              order: typeof pref.order === 'number' ? pref.order : index + 1,
              visible: !!pref.visible,
            }));

          if (sanitized.length === 0) {
            const defaultPrefs = generateDefaultColumnPreferences((fields || []) as LeadFieldDefinition[]);
            setColumnPreferences(defaultPrefs);
          } else {
            setColumnPreferences(sanitized);
            // Persist back if changed so old users stop seeing removed columns
            const changed = sanitized.length !== rawPrefs.length || sanitized.some((p, i) => p.key !== rawPrefs[i]?.key);
            if (changed) {
              try {
                const { data: user } = await supabase.auth.getUser();
                if (user.user?.id) {
                  await supabase
                    .from('user_column_preferences')
                    .upsert({
                      user_id: user.user.id,
                      table_name: 'leads',
                      column_config: sanitized as any,
                    }, { onConflict: 'user_id,table_name' });
                }
              } catch (e) {
                console.error('Error persisting sanitized preferences:', e);
              }
            }
          }
        } else {
          // Set default preferences if none exist
          const defaultPrefs = generateDefaultColumnPreferences((fields || []) as LeadFieldDefinition[]);
          setColumnPreferences(defaultPrefs);
        }
      } catch (error) {
        console.error('Error fetching table column data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Generate default column preferences
  const generateDefaultColumnPreferences = (fields: LeadFieldDefinition[]): ColumnConfig[] => {
    const defaultColumns: ColumnConfig[] = [
      // Default order: Name, Status, Phone Number, Email address, Last Updated
      { key: 'name', visible: true, order: 1 },
      { key: 'status', visible: true, order: 2 },
      { key: 'phone', visible: true, order: 3 },
      { key: 'email', visible: true, order: 4 },
      { key: 'updated_at', visible: true, order: 5 },
    ];

    // Add other custom fields that are visible in table
    const customFieldColumns = fields
      .filter(field => field.is_visible_in_table && !['name', 'phone', 'email'].includes(field.field_key))
      .map((field, index) => ({
        key: field.field_key,
        visible: false, // Default to hidden for additional custom fields
        order: 6 + index,
      }));

    return [...defaultColumns, ...customFieldColumns];
  };

  // Generate column definitions for DataTable
  const columns = useMemo((): Column<LeadWithCustomFields>[] => {
    const visiblePrefs = columnPreferences
      .filter(pref => pref.visible)
      .sort((a, b) => a.order - b.order);

    return visiblePrefs.map(pref => {
      const fieldDef = fieldDefinitions.find(f => f.field_key === pref.key);

      // System columns that map to lead properties
      if (pref.key === 'name') {
        const nameFieldDef = fieldDefinitions.find(f => f.field_key === 'name');
        return {
          key: 'name',
          header: nameFieldDef?.label || t('lead_table_columns.name'),
          sortable: true,
          accessor: (lead) => lead.custom_fields['name'] || lead.name,
          render: (lead) => React.createElement('span', {
            className: "font-medium"
          }, lead.custom_fields['name'] || lead.name || '-'),
        };
      }

      if (pref.key === 'email') {
        const emailFieldDef = fieldDefinitions.find(f => f.field_key === 'email');
        return {
          key: 'email',
          header: emailFieldDef?.label || t('lead_table_columns.email'),
          sortable: true,
          accessor: (lead) => lead.custom_fields['email'] || lead.email,
          render: (lead) => {
            const value = lead.custom_fields['email'] || lead.email;
            return emailFieldDef 
              ? React.createElement(CustomFieldDisplay, {
                  fieldDefinition: emailFieldDef,
                  value: value,
                  tableContext: true
                })
              : React.createElement('span', {}, value || '-');
          },
        };
      }

      if (pref.key === 'phone') {
        const phoneFieldDef = fieldDefinitions.find(f => f.field_key === 'phone');
        return {
          key: 'phone',
          header: phoneFieldDef?.label || t('lead_table_columns.phone'),
          sortable: true,
          accessor: (lead) => lead.custom_fields['phone'] || lead.phone,
          render: (lead) => {
            const value = lead.custom_fields['phone'] || lead.phone;
            return phoneFieldDef 
              ? React.createElement(CustomFieldDisplay, {
                  fieldDefinition: phoneFieldDef,
                  value: value,
                  tableContext: true
                })
              : React.createElement('span', {}, value || '-');
          },
        };
      }

      if (pref.key === 'status') {
        return {
          key: 'status',
          header: t('lead_table_columns.status'),
          sortable: true,
          render: (lead) => React.createElement(LeadStatusBadge, {
            leadId: lead.id,
            currentStatusId: lead.status_id,
            currentStatus: lead.status,
            onStatusChange: () => {}, // Will be passed from parent
            editable: false,
            size: "sm"
          }),
        };
      }

      // Remove assignees column - not applicable for single photographer mode

      if (pref.key === 'updated_at') {
        return {
          key: 'updated_at',
          header: t('lead_table_columns.last_updated'),
          sortable: true,
          render: (lead) => React.createElement('span', {
            className: "text-sm text-muted-foreground"
          }, formatDate(lead.updated_at)),
        };
      }

      // Custom field columns
      if (fieldDef) {
        return {
          key: `custom_fields.${fieldDef.field_key}`,
          header: fieldDef.label,
          sortable: true,
          accessor: (lead) => lead.custom_fields[fieldDef.field_key],
          render: (lead) => React.createElement(CustomFieldDisplay, {
            fieldDefinition: fieldDef,
            value: lead.custom_fields[fieldDef.field_key],
            tableContext: true
          }),
        };
      }

      return {
        key: pref.key,
        header: pref.key,
        sortable: false,
        render: () => React.createElement('span', {}, '-'),
      };
    });
  }, [columnPreferences, fieldDefinitions]);

  // Save column preferences
  const saveColumnPreferences = async (newPreferences: ColumnConfig[]) => {
    try {
      console.log('Saving column preferences:', newPreferences);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('user_column_preferences')
        .upsert({
          user_id: user.user.id,
          table_name: 'leads',
          column_config: newPreferences as any,
        }, {
          onConflict: 'user_id,table_name'
        });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Successfully saved preferences, updating state');
      setColumnPreferences(newPreferences);
    } catch (error) {
      console.error('Error saving column preferences:', error);
      throw error;
    }
  };

  // Get available columns for configuration
  const availableColumns = useMemo(() => {
    const coreColumns = [
      { key: 'name', label: t('lead_table_columns.name'), isCore: false },
      { key: 'status', label: t('lead_table_columns.status'), isCore: true },
      { key: 'phone', label: t('lead_table_columns.phone'), isCore: false },
      { key: 'email', label: t('lead_table_columns.email'), isCore: false },
      { key: 'updated_at', label: t('lead_table_columns.last_updated'), isCore: true },
    ];

    const customColumns = fieldDefinitions
      .filter(field => !['name', 'phone', 'email'].includes(field.field_key))
      .map(field => ({
        key: field.field_key,
        label: field.label,
        isCore: false,
        fieldDefinition: field,
      }));

    return [...coreColumns, ...customColumns];
  }, [fieldDefinitions]);

  // Reset to default preferences
  const resetToDefault = async () => {
    const defaultPrefs = generateDefaultColumnPreferences(fieldDefinitions);
    await saveColumnPreferences(defaultPrefs);
  };

  return {
    columns,
    columnPreferences,
    availableColumns,
    fieldDefinitions,
    loading,
    saveColumnPreferences,
    resetToDefault,
  };
}