import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { TemplateVariable } from "@/types/templateBuilder";
import { useTranslation } from "react-i18next";

interface BusinessInfo {
  name: string;
  logo_url: string | null;
  primary_brand_color: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

export function useTemplateVariables() {
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { activeOrganization } = useOrganization();
  const { t, i18n } = useTranslation("pages");

  const fetchVariables = useCallback(async () => {
    if (!activeOrganization?.id) return;

    try {
      setLoading(true);

      const leadFieldTranslationMap: Record<string, string> = {
        name: t("templateBuilder.variables.labels.leadFullName"),
        full_name: t("templateBuilder.variables.labels.leadFullName"),
        email: t("templateBuilder.variables.labels.leadEmail"),
        phone: t("templateBuilder.variables.labels.leadPhone"),
        notes: t("templateBuilder.variables.labels.leadNotes"),
        status: t("templateBuilder.variables.labels.leadStatus")
      };

      // Fetch organization settings for business info
      const { data: orgSettings } = await supabase
        .from("organization_settings")
        .select("photography_business_name, logo_url, primary_brand_color")
        .eq("organization_id", activeOrganization.id)
        .single();

      // Fetch lead field definitions for dynamic variables
      const { data: leadFields } = await supabase
        .from("lead_field_definitions")
        .select("field_key, label, field_type")
        .eq("organization_id", activeOrganization.id)
        .order("sort_order");

      // Set business info
      if (orgSettings) {
        setBusinessInfo({
          name: orgSettings.photography_business_name || "Your Business",
          logo_url: orgSettings.logo_url,
          primary_brand_color: orgSettings.primary_brand_color || "#1EB29F",
        });
      }

      // Build template variables
      const templateVariables: TemplateVariable[] = [
        // Business variables (only real ones from organization_settings)
        {
          key: "business_name",
          label: t("templateBuilder.variables.labels.businessName"),
          category: "business"
        },

        // Lead variables from field definitions
        ...(leadFields?.map(field => {
          const translatedLabel = leadFieldTranslationMap[field.field_key] ?? field.label;
          return {
            key: `lead_${field.field_key}`,
            label: translatedLabel,
            category: "lead" as const
          };
        }) || []),

        // Static lead variables that exist in database
        {
          key: "lead_status",
          label: t("templateBuilder.variables.labels.leadStatus"),
          category: "lead"
        },
        {
          key: "lead_due_date",
          label: t("templateBuilder.variables.labels.leadDueDate"), 
          category: "lead"
        },
        {
          key: "lead_created_date",
          label: t("templateBuilder.variables.labels.leadCreatedDate"),
          category: "lead"
        },
        {
          key: "lead_updated_date",
          label: t("templateBuilder.variables.labels.leadUpdatedDate"),
          category: "lead"
        },

        // Session variables (real database fields)
        {
          key: "session_name",
          label: t("templateBuilder.variables.labels.sessionName"),
          category: "session"
        },
        {
          key: "session_date",
          label: t("templateBuilder.variables.labels.sessionDate"),
          category: "session"
        },
        {
          key: "session_time", 
          label: t("templateBuilder.variables.labels.sessionTime"),
          category: "session"
        },
        {
          key: "session_location",
          label: t("templateBuilder.variables.labels.sessionLocation"),
          category: "session"
        },
        {
          key: "session_notes",
          label: t("templateBuilder.variables.labels.sessionNotes"),
          category: "session"
        },
        {
          key: "session_status",
          label: t("templateBuilder.variables.labels.sessionStatus"),
          category: "session"
        },
        {
          key: "session_type",
          label: t("templateBuilder.variables.labels.sessionType"),
          category: "session"
        },
        {
          key: "session_duration",
          label: t("templateBuilder.variables.labels.sessionDuration"),
          category: "session"
        },
        {
          key: "session_meeting_url",
          label: t("templateBuilder.variables.labels.sessionMeetingUrl"),
          category: "session"
        },

        // Project variables (real database fields)
        {
          key: "project_name",
          label: t("templateBuilder.variables.labels.projectName"),
          category: "project"
        },
        {
          key: "project_type",
          label: t("templateBuilder.variables.labels.projectType"), 
          category: "project"
        },
        {
          key: "project_status",
          label: t("templateBuilder.variables.labels.projectStatus"),
          category: "project"
        },
        {
          key: "project_due_date",
          label: t("templateBuilder.variables.labels.projectDueDate"),
          category: "project"
        },
        {
          key: "project_package_name",
          label: t("templateBuilder.variables.labels.projectPackageName"),
          category: "project"
        },

        // System variables
        {
          key: "current_date",
          label: t("templateBuilder.variables.labels.currentDate"),
          category: "custom"
        },
        {
          key: "current_time",
          label: t("templateBuilder.variables.labels.currentTime"), 
          category: "custom"
        }
      ];

      const uniqueVariables = Array.from(
        templateVariables.reduce((map, variable) => {
          map.set(variable.key, variable);
          return map;
        }, new Map<string, TemplateVariable>()).values()
      );

      setVariables(uniqueVariables);
    } catch (error) {
      console.error("Error fetching template variables:", error);
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, t, i18n.language]);

  useEffect(() => {
    if (activeOrganization?.id) {
      void fetchVariables();
    } else {
      setLoading(false);
    }
  }, [activeOrganization?.id, fetchVariables]);

  const getVariableValue = useCallback((key: string, mockData?: Record<string, string>): string => {
    // If mock data is provided, use it first
    if (mockData && mockData[key]) {
      return mockData[key];
    }

    // Business variables (only real ones)
    if (key === "business_name") return businessInfo?.name || "Your Business";

    // Lead variables with fallbacks
    if (key.startsWith("lead_")) {
      const fieldKey = key.replace("lead_", "");
      if (fieldKey === "name") return "John Smith";
      if (fieldKey === "email") return "john@example.com";
      if (fieldKey === "phone") return "-"; // Show dash for empty phone
      if (fieldKey === "notes") return "Sample notes";
      if (fieldKey === "status") return "New";
      if (fieldKey === "due_date") return new Date().toLocaleDateString();
      if (fieldKey === "created_date") return new Date().toLocaleDateString();
      if (fieldKey === "updated_date") return new Date().toLocaleDateString();
      // For custom fields, return placeholder
      return `Sample ${fieldKey}`;
    }

    // Session variables (real database fields)
    if (key === "session_name") return "Signature Portrait Session";
    if (key === "session_type") return "Engagement Session";
    if (key === "session_duration") return "90 minutes";
    if (key === "session_meeting_url") return "https://meet.example.com/lumiso-session";
    if (key === "session_date") return new Date().toLocaleDateString();
    if (key === "session_time") return "2:00 PM";  
    if (key === "session_location") return "Studio Location";
    if (key === "session_notes") return "Bring comfortable clothes";
    if (key === "session_status") return "Planned";

    // Project variables (real database fields)
    if (key === "project_name") return "Wedding Photography";
    if (key === "project_type") return "Wedding";
    if (key === "project_status") return "In Progress";
    if (key === "project_due_date") return new Date().toLocaleDateString();
    if (key === "project_package_name") return "Signature Wedding Collection";

    // System variables
    if (key === "current_date") return new Date().toLocaleDateString();
    if (key === "current_time") return new Date().toLocaleTimeString();

    return `{${key}}`;
  }, [businessInfo]);

  return useMemo(() => ({
    variables,
    businessInfo,
    loading,
    getVariableValue,
    refetch: fetchVariables
  }), [variables, businessInfo, loading, getVariableValue, fetchVariables]);
}
