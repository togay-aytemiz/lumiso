import { supabase } from "@/integrations/supabase/client";

export async function getUserOrganizationId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // First try to get from user settings
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('active_organization_id')
      .eq('user_id', user.id)
      .single();

    if (userSettings?.active_organization_id) {
      return userSettings.active_organization_id;
    }

    // Fallback to first active membership
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('joined_at', { ascending: true })
      .limit(1)
      .single();

    return membership?.organization_id || null;
  } catch (error) {
    console.error('Error getting user organization ID:', error);
    return null;
  }
}