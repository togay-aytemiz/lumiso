import { supabase } from "@/integrations/supabase/client";

export async function getUserOrganizationId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Use the optimized database function for better performance
    const { data, error } = await supabase.rpc('get_user_active_organization_id');
    
    if (error) {
      console.error('Error getting user organization ID:', error);
      return null;
    }
    
    return data || null;
  } catch (error) {
    console.error('Error getting user organization ID:', error);
    return null;
  }
}