import { useOrganization } from "@/contexts/OrganizationContext";

export function useOptionalOrganization() {
  try {
    return useOrganization();
  } catch {
    return undefined;
  }
}
