import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { TemplateVariable } from "@/types/templateBuilder";

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

  useEffect(() => {
    if (activeOrganization?.id) {
      fetchVariables();
    }
  }, [activeOrganization?.id]);

  const fetchVariables = async () => {
    if (!activeOrganization?.id) return;

    try {
      setLoading(true);

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
          label: "Business Name",
          category: "business"
        },
        {
          key: "business_phone",
          label: "Business Phone", 
          category: "business"
        },
        {
          key: "business_email",
          label: "Business Email",
          category: "business"
        },

        // Lead variables from field definitions
        ...(leadFields?.map(field => ({
          key: `lead_${field.field_key}`,
          label: `Lead ${field.label}`,
          category: "lead" as const
        })) || []),

        // Static lead variables that exist in database
        {
          key: "lead_status",
          label: "Lead Status",
          category: "lead"
        },
        {
          key: "lead_due_date",
          label: "Lead Due Date", 
          category: "lead"
        },
        {
          key: "lead_created_date",
          label: "Lead Created Date",
          category: "lead"
        },
        {
          key: "lead_updated_date",
          label: "Lead Updated Date",
          category: "lead"
        },

        // Session variables (real database fields)
        {
          key: "session_date",
          label: "Session Date",
          category: "session"
        },
        {
          key: "session_time", 
          label: "Session Time",
          category: "session"
        },
        {
          key: "session_location",
          label: "Session Location",
          category: "session"
        },
        {
          key: "session_notes",
          label: "Session Notes",
          category: "session"
        },
        {
          key: "session_status",
          label: "Session Status",
          category: "session"
        },

        // Project variables (real database fields)
        {
          key: "project_name",
          label: "Project Name",
          category: "session"
        },
        {
          key: "project_type",
          label: "Project Type", 
          category: "session"
        },
        {
          key: "project_status",
          label: "Project Status",
          category: "session"
        },
        {
          key: "project_due_date",
          label: "Project Due Date",
          category: "session"
        },

        // System variables
        {
          key: "current_date",
          label: "Current Date",
          category: "custom"
        },
        {
          key: "current_time",
          label: "Current Time", 
          category: "custom"
        }
      ];

      setVariables(templateVariables);
    } catch (error) {
      console.error("Error fetching template variables:", error);
    } finally {
      setLoading(false);
    }
  };

  const getVariableValue = (key: string, mockData?: Record<string, string>): string => {
    // If mock data is provided, use it first
    if (mockData && mockData[key]) {
      return mockData[key];
    }

    // Business variables (only real ones)
    if (key === "business_name") return businessInfo?.name || "Your Business";
    if (key === "business_phone") return "+1 (555) 123-4567"; // placeholder
    if (key === "business_email") return "hello@yourbusiness.com"; // placeholder

    // Lead variables
    if (key.startsWith("lead_")) {
      const fieldKey = key.replace("lead_", "");
      if (fieldKey === "name") return "John Smith";
      if (fieldKey === "email") return "john@example.com";
      if (fieldKey === "phone") return "+1 (555) 987-6543";
      if (fieldKey === "status") return "New";
      if (fieldKey === "due_date") return new Date().toLocaleDateString();
      if (fieldKey === "created_date") return new Date().toLocaleDateString();
      if (fieldKey === "updated_date") return new Date().toLocaleDateString();
    }

    // Session variables (real database fields)
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

    // System variables
    if (key === "current_date") return new Date().toLocaleDateString();
    if (key === "current_time") return new Date().toLocaleTimeString();

    return `{${key}}`;
  };

  return {
    variables,
    businessInfo,
    loading,
    getVariableValue,
    refetch: fetchVariables
  };
}