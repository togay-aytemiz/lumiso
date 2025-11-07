import { supabase } from "@/integrations/supabase/client";
import type { LeadFieldDefinition } from "@/types/leadFields";

const STORAGE_PREFIX = "lead_field_definitions:";

export const LEAD_FIELD_DEFINITIONS_STALE_TIME = 10 * 60 * 1000; // 10 minutes
export const LEAD_FIELD_DEFINITIONS_GC_TIME = 30 * 60 * 1000; // 30 minutes

export const leadFieldDefinitionsQueryKey = (organizationId?: string) =>
  ["lead_field_definitions", organizationId] as const;

const getStorageKey = (organizationId: string) =>
  `${STORAGE_PREFIX}${organizationId}`;

export async function fetchLeadFieldDefinitionsForOrganization(
  organizationId: string
): Promise<LeadFieldDefinition[]> {
  try {
    const { data: authUser } = await supabase.auth.getUser();
    await supabase.rpc("ensure_default_lead_field_definitions", {
      org_id: organizationId,
      user_uuid: authUser.user?.id,
    });
  } catch (error) {
    console.warn(
      "Failed to ensure default lead field definitions before fetch",
      error
    );
  }

  const { data, error } = await supabase
    .from("lead_field_definitions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as LeadFieldDefinition[];
}

export function persistLeadFieldDefinitionsToStorage(
  organizationId: string,
  definitions: LeadFieldDefinition[]
) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      getStorageKey(organizationId),
      JSON.stringify(definitions)
    );
  } catch (error) {
    console.warn("Failed to cache lead field definitions", error);
  }
}

export function readLeadFieldDefinitionsFromStorage(
  organizationId?: string
): LeadFieldDefinition[] | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    if (organizationId) {
      const raw = localStorage.getItem(getStorageKey(organizationId));
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : undefined;
    }

    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(STORAGE_PREFIX)
    );
    if (!keys.length) return undefined;

    const sortedKeys = keys.sort();
    const latestKey = sortedKeys[sortedKeys.length - 1];
    if (!latestKey) return undefined;

    const raw = localStorage.getItem(latestKey);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch (error) {
    console.warn("Failed to load lead field definitions cache", error);
    return undefined;
  }
}
