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

    // Use the optimized database function for better performance
    const { data, error } = await supabase.rpc('get_user_active_organization_id');
    
    if (error) {
      console.error('Error getting user organization ID:', error);
      return null;
    }
    
    // Update cache
    cachedOrganizationId = data || null;
    cacheExpiry = Date.now() + CACHE_DURATION;
    
    return data || null;
  } catch (error) {
    console.error('Error getting user organization ID:', error);
    return null;
  }
}

export function clearOrganizationCache() {
  cachedOrganizationId = null;
  cacheExpiry = 0;
}