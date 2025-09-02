import { supabase } from "@/integrations/supabase/client";

// Cache for organization ID to reduce database calls
let cachedOrganizationId: string | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getUserOrganizationId(): Promise<string | null> {
  try {
    // Check if we have a valid cached value
    if (cachedOrganizationId && Date.now() < cacheExpiry) {
      return cachedOrganizationId;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      clearOrganizationCache();
      return null;
    }

    // First try to get the active organization from user settings
    let { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('active_organization_id')
      .eq('user_id', user.id)
      .single();

    if (!settingsError && userSettings?.active_organization_id) {
      cachedOrganizationId = userSettings.active_organization_id;
      cacheExpiry = Date.now() + CACHE_DURATION;
      console.log('Found organization ID from user settings:', cachedOrganizationId);
      return cachedOrganizationId;
    }

    // Fallback to first active membership
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    if (!membershipError && membership?.organization_id) {
      cachedOrganizationId = membership.organization_id;
      cacheExpiry = Date.now() + CACHE_DURATION;
      console.log('Found organization ID from membership:', cachedOrganizationId);
      return cachedOrganizationId;
    }

    console.warn('No organization found for user:', user.id);
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