import { addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

// Cache for organization ID to reduce database calls
let cachedOrganizationId: string | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DEFAULT_TRIAL_DAYS = 14;
let membershipTableUnavailable = false;
const MEMBERSHIP_ENFORCEMENT_ENABLED =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_ENABLE_MEMBERSHIP_ENFORCEMENT === "true") ||
  false;

type MembershipUpdates = {
  status?: string;
  role?: string;
  system_role?: string;
};

const handleMembershipTableError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
  if (code === 'PGRST205') {
    membershipTableUnavailable = true;
    console.warn('organization_members table not available; skipping membership enforcement until schema sync completes.');
    return true;
  }
  return false;
};

const ensureOwnerMembership = async (userId: string, organizationId: string) => {
  if (!MEMBERSHIP_ENFORCEMENT_ENABLED || membershipTableUnavailable) {
    return;
  }

  try {
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('id, status, role, system_role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (membershipError) {
      if (membershipError.code === 'PGRST116') {
        // no rows, continue to insert
      } else if (handleMembershipTableError(membershipError)) {
        return;
      } else {
        console.error('Failed to verify organization membership:', membershipError);
        return;
      }
    }

    if (!membership) {
      const { error: insertError } = await supabase.from('organization_members').insert({
        organization_id: organizationId,
        user_id: userId,
        role: 'Owner',
        system_role: 'Owner',
        status: 'active',
      });

      if (insertError) {
        if (handleMembershipTableError(insertError)) {
          return;
        }
        console.error('Failed to seed owner membership:', insertError);
      }
      return;
    }

    const pendingUpdates: MembershipUpdates = {};
    if (membership.status !== 'active') {
      pendingUpdates.status = 'active';
    }
    if (!membership.role) {
      pendingUpdates.role = 'Owner';
    }
    if (!membership.system_role) {
      pendingUpdates.system_role = 'Owner';
    }

    if (Object.keys(pendingUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('organization_members')
        .update(pendingUpdates)
        .eq('id', membership.id);
      if (updateError) {
        if (handleMembershipTableError(updateError)) {
          return;
        }
        console.error('Failed to normalize owner membership:', updateError);
      }
    }
  } catch (error) {
    if (!handleMembershipTableError(error)) {
      console.error('Error ensuring owner membership:', error);
    }
  }
};

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
      await ensureOwnerMembership(user.id, organization.id);
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

        await ensureOwnerMembership(user.id, newOrg.id);
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
  membershipTableUnavailable = false;
}
