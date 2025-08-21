import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingState {
  inGuidedSetup: boolean;
  guidedSetupSkipped: boolean;
  guidanceCompleted: boolean;
  completedCount: number;
  loading: boolean;
}

export function useOnboarding() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    inGuidedSetup: true,
    guidedSetupSkipped: false,
    guidanceCompleted: false,
    completedCount: 0,
    loading: true
  });

  const fetchState = async () => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('in_guided_setup, guided_setup_skipped, guidance_completed, completed_steps_count')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching state:', error);
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      if (!data) {
        // Create default settings
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            completed_steps_count: 0,
            in_guided_setup: true,
            guidance_completed: false,
            guided_setup_skipped: false
          });

        if (insertError) {
          console.error('Error creating settings:', insertError);
        }

        console.log('🔧 Created new user settings - inGuidedSetup: true');
        setState({
          inGuidedSetup: true,
          guidedSetupSkipped: false,
          guidanceCompleted: false,
          completedCount: 0,
          loading: false
        });
        return;
      }

      console.log('🔍 Fetched user settings:', {
        in_guided_setup: data.in_guided_setup,
        completed_steps_count: data.completed_steps_count,
        guidance_completed: data.guidance_completed,
        guided_setup_skipped: data.guided_setup_skipped,
        timestamp: new Date().toISOString()
      });

      // Simple logic: Use database values directly, no automatic completion based on step count
      setState({
        inGuidedSetup: data.in_guided_setup ?? true,
        guidedSetupSkipped: data.guided_setup_skipped ?? false,
        guidanceCompleted: data.guidance_completed ?? false,
        completedCount: data.completed_steps_count ?? 0,
        loading: false
      });
    } catch (error) {
      console.error('Error:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchState();
  }, [user]);

  const shouldShowOnboarding = () => {
    if (state.loading || !user) return false;
    if (state.guidedSetupSkipped || state.guidanceCompleted) return false;
    // Show onboarding modal when NOT in guided setup and haven't completed onboarding
    return !state.inGuidedSetup && state.completedCount === 0;
  };

  const completeStep = async () => {
    if (!user) return;

    try {
      console.log('🔄 Completing step, current count:', state.completedCount);
      
      // Simply complete the step (increments count)
      const result = await supabase.rpc('complete_onboarding_step', {
        user_uuid: user.id
      });

      console.log('✅ Step completion result:', result);

      // Just refresh state - no automatic guided mode completion
      await fetchState();
      
      console.log('🔍 Step completion process finished');
    } catch (error) {
      console.error('Error completing step:', error);
      throw error;
    }
  };

  const completeGuidedMode = async () => {
    if (!user) return;

    try {
      console.log('🏁 Completing guided mode');
      
      // Direct database update until types are refreshed
      await supabase
        .from('user_settings')
        .update({ 
          guidance_completed: true,
          in_guided_setup: false 
        })
        .eq('user_id', user.id);

      console.log('✅ Guided mode marked as complete');

      // Update local state immediately
      setState(prev => ({
        ...prev,
        guidanceCompleted: true,
        inGuidedSetup: false,
        loading: false
      }));
      
      console.log('🔍 Guided mode completion finished');
    } catch (error) {
      console.error('Error completing guided mode:', error);
      throw error;
    }
  };

  const skipWithSampleData = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_settings')
        .update({ 
          guided_setup_skipped: true,
          in_guided_setup: false 
        })
        .eq('user_id', user.id);

      setState(prev => ({
        ...prev,
        inGuidedSetup: false,
        guidedSetupSkipped: true,
      }));
    } catch (error) {
      console.error('Error skipping:', error);
      throw error;
    }
  };

  const resetOnboardingState = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_settings')
        .update({
          completed_steps_count: 0,
          in_guided_setup: true, // Keep in guided setup when resetting
          guidance_completed: false,
          guided_setup_skipped: false
        })
        .eq('user_id', user.id);

      setState({
        inGuidedSetup: true, // Keep in guided setup when resetting  
        guidedSetupSkipped: false,
        guidanceCompleted: false,
        completedCount: 0,
        loading: false
      });
    } catch (error) {
      console.error('Error resetting:', error);
    }
  };

  const startGuidedSetup = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_settings')
        .update({ 
          in_guided_setup: true,
          guided_setup_skipped: false 
        })
        .eq('user_id', user.id);

      window.location.reload();
    } catch (error) {
      console.error('Error starting setup:', error);
      throw error;
    }
  };

  return {
    ...state,
    shouldShowOnboarding: shouldShowOnboarding(),
    completeStep,
    completeGuidedMode,
    skipWithSampleData,
    resetOnboardingState,
    startGuidedSetup
  };
}