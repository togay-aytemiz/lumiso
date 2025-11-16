import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// Cache for organization ID to reduce database calls
let cachedOrganizationId: string | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TRIAL_DAYS = 14;

export async function getUserOrganizationId(): Promise<string | null> {
  try {
    // Check if we have a valid cached value
    if (cachedOrganizationId && Date.now() < cacheExpiry) {
      return cachedOrganizationId;
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("Error fetching authenticated user:", authError);
      clearOrganizationCache();
      return null;
    }

    const user = authData?.user;
    if (!user) {
      clearOrganizationCache();
      return null;
    }

    // For single photographer: find organization owned by this user
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (!orgError && organization?.id) {
      cachedOrganizationId = organization.id;
      cacheExpiry = Date.now() + CACHE_DURATION;
      console.log('Found organization ID for single user:', cachedOrganizationId);
      return cachedOrganizationId;
    }

    // If no organization exists, create one for the single photographer
    if (orgError?.code === 'PGRST116') { // No rows returned
      console.log('Creating organization for single photographer:', user.id);
      const now = new Date();
      const nowIso = now.toISOString();
      const trialExpires = addDays(now, DEFAULT_TRIAL_DAYS).toISOString();
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: 'My Photography Business',
          owner_id: user.id,
          membership_status: 'trial',
          trial_started_at: nowIso,
          trial_expires_at: trialExpires,
          trial_extended_by_days: 0,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating organization:', createError);
        return null;
      }

      // Initialize organization settings and default data
      if (newOrg?.id) {
        try {
          // Create organization settings
          await supabase.rpc('ensure_organization_settings', { 
            org_id: newOrg.id,
            detected_locale:
              typeof navigator !== "undefined" ? navigator.language : undefined,
          });

          // Create default lead field definitions
          await supabase.rpc('ensure_default_lead_field_definitions', { 
            org_id: newOrg.id, 
            user_uuid: user.id 
          });

          // Create default lead statuses
          await supabase.rpc('ensure_default_lead_statuses_for_org', { 
            user_uuid: user.id, 
            org_id: newOrg.id 
          });

          // Create default project statuses
          await supabase.rpc('ensure_default_project_statuses_for_org', { 
            user_uuid: user.id, 
            org_id: newOrg.id 
          });

          // Create default session statuses
          await supabase.rpc('ensure_default_session_statuses', { 
            user_uuid: user.id,
            org_id: newOrg.id 
          });

          // Create default project types
          await supabase.rpc('ensure_default_project_types_for_org', { 
            user_uuid: user.id, 
            org_id: newOrg.id 
          });

          console.log('Initialized default data for new organization');
        } catch (initError) {
          console.warn('Some default data initialization failed:', initError);
        }

        cachedOrganizationId = newOrg.id;
        cacheExpiry = Date.now() + CACHE_DURATION;
        return newOrg.id;
      }
    }

    console.error('Failed to find or create organization for user:', user.id, orgError);
    return null;
  } catch (error) {
    console.error('Error getting user organization ID:', error);
    return null;
  }
}

export function clearOrganizationCache() {
  cachedOrganizationId = null;
  cacheExpiry = 0;
}
