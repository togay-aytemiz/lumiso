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
        // Business variables
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
        {
          key: "business_address",
          label: "Business Address",
          category: "business"
        },
        {
          key: "business_website",
          label: "Business Website",
          category: "business"
        },

        // Lead variables from field definitions
        ...(leadFields?.map(field => ({
          key: `lead_${field.field_key}`,
          label: `Lead ${field.label}`,
          category: "lead" as const
        })) || []),

        // Static lead variables
        {
          key: "lead_status",
          label: "Lead Status",
          category: "lead"
        },
        {
          key: "lead_created_date",
          label: "Lead Created Date",
          category: "lead"
        },

        // Session variables
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
          key: "session_type",
          label: "Session Type",
          category: "session"
        },
        {
          key: "session_status",
          label: "Session Status",
          category: "session"
        },
        {
          key: "session_notes",
          label: "Session Notes",
          category: "session"
        },

        // Custom variables
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

    // Business variables
    if (key === "business_name") return businessInfo?.name || "Your Business";
    if (key === "business_phone") return "+1 (555) 123-4567";
    if (key === "business_email") return "hello@yourbusiness.com";
    if (key === "business_address") return "123 Main St, City, State 12345";
    if (key === "business_website") return "www.yourbusiness.com";

    // Lead variables
    if (key.startsWith("lead_")) {
      const fieldKey = key.replace("lead_", "");
      if (fieldKey === "name") return "John Smith";
      if (fieldKey === "email") return "john@example.com";
      if (fieldKey === "phone") return "+1 (555) 987-6543";
      if (fieldKey === "status") return "New";
      if (fieldKey === "created_date") return new Date().toLocaleDateString();
    }

    // Session variables
    if (key === "session_date") return new Date().toLocaleDateString();
    if (key === "session_time") return "2:00 PM";
    if (key === "session_location") return "Studio Location";
    if (key === "session_type") return "Portrait Session";
    if (key === "session_status") return "Planned";
    if (key === "session_notes") return "Bring comfortable clothes";

    // Custom variables
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