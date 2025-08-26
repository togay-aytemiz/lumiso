// Utility to clean up old onboarding data after migration
import { supabase } from "@/integrations/supabase/client";

export const cleanupOldOnboardingColumns = async () => {
  // This should be run AFTER confirming the new system works
  // It removes the old columns that are no longer needed
  
  console.log('⚠️  This will remove old onboarding columns from user_settings');
  console.log('Only run this AFTER confirming the new system works properly');
  
  // Uncomment these lines ONLY after testing is complete:
  /*
  const migrations = [
    'ALTER TABLE user_settings DROP COLUMN IF EXISTS in_guided_setup;',
    'ALTER TABLE user_settings DROP COLUMN IF EXISTS guided_setup_skipped;', 
    'ALTER TABLE user_settings DROP COLUMN IF EXISTS guidance_completed;',
    'ALTER TABLE user_settings DROP COLUMN IF EXISTS current_step;',
    'ALTER TABLE user_settings DROP COLUMN IF EXISTS completed_steps;',
    'ALTER TABLE user_settings DROP COLUMN IF EXISTS completed_steps_count;'
  ];
  
  for (const migration of migrations) {
    const { error } = await supabase.rpc('execute_sql', { sql: migration });
    if (error) {
      console.error('Migration error:', error);
    } else {
      console.log('✅ Executed:', migration);
    }
  }
  */
  
  console.log('🔒 Cleanup disabled for safety. Enable manually after testing.');
};