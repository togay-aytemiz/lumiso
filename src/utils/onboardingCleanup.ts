// Utility to clean up old onboarding data after migration
import { supabase } from "@/integrations/supabase/client";

export const cleanupOldOnboardingColumns = async () => {
  // V3 Database cleanup - production ready
  try {
    const { data, error } = await supabase.rpc('cleanup_old_onboarding_columns_v3');
    
    if (error) {
      console.error('Database cleanup failed:', error);
      return false;
    }
    
    return data || 'Cleanup completed successfully';
  } catch (error) {
    console.error('Cleanup error:', error);
    return false;
  }
};