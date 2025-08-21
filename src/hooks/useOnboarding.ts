import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingState {
  inGuidedSetup: boolean;
  guidedSetupSkipped: boolean;
  guidanceCompleted: boolean;
  currentStep: number;
  completedSteps: number[];
  loading: boolean;
}

export function useOnboarding() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    inGuidedSetup: false,
    guidedSetupSkipped: false,
    guidanceCompleted: false,
    currentStep: 1,
    completedSteps: [],
    loading: true
  });

  const fetchOnboardingState = async () => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // First try to get existing settings
      const { data, error } = await supabase
        .from('user_settings')
        .select('in_guided_setup, guided_setup_skipped, guidance_completed, current_step, completed_steps')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching onboarding state:', error);
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // If no settings exist, create them
      if (!data) {
        console.log('🔧 No user settings found, creating default settings...');
        const { data: newData, error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            show_quick_status_buttons: true,
            photography_business_name: '',
            primary_brand_color: '#1EB29F',
            date_format: 'DD/MM/YYYY',
            time_format: '12-hour',
            notification_global_enabled: true,
            notification_daily_summary_enabled: true,
            notification_weekly_recap_enabled: true,
            notification_new_assignment_enabled: true,
            notification_project_milestone_enabled: true,
            notification_scheduled_time: '09:00',
            in_guided_setup: true,
            guided_setup_skipped: false,
            guidance_completed: false,
            current_step: 1,
            completed_steps: []
          })
          .select('in_guided_setup, guided_setup_skipped, guidance_completed, current_step, completed_steps')
          .single();

        if (insertError) {
          console.error('Error creating user settings:', insertError);
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        const completedStepsArray = Array.isArray(newData?.completed_steps) 
          ? (newData.completed_steps as number[])
          : [];

        setState({
          inGuidedSetup: newData?.in_guided_setup || true,
          guidedSetupSkipped: newData?.guided_setup_skipped || false,
          guidanceCompleted: newData?.guidance_completed || false,
          currentStep: newData?.current_step || 1,
          completedSteps: completedStepsArray,
          loading: false
        });
        console.log('✅ Created default user settings');
        return;
      }

      const completedStepsArray = Array.isArray(data?.completed_steps) 
        ? (data.completed_steps as number[])
        : [];

      setState({
        inGuidedSetup: data?.in_guided_setup || false,
        guidedSetupSkipped: data?.guided_setup_skipped || false,
        guidanceCompleted: data?.guidance_completed || false,
        currentStep: data?.current_step || 1,
        completedSteps: completedStepsArray,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching onboarding state:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchOnboardingState();
  }, [user]);

  const shouldShowOnboarding = () => {
    if (state.loading || !user) {
      return false;
    }
    
    // Don't show if user has completed or skipped guided setup
    if (state.guidedSetupSkipped || state.guidanceCompleted) {
      return false;
    }
    
    // Show if user hasn't started guided setup yet
    return !state.inGuidedSetup;
  };

  const startGuidedSetup = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          in_guided_setup: true,
          guided_setup_skipped: false 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Force page reload for immediate UI update
      window.location.reload();
    } catch (error) {
      console.error('Error starting guided setup:', error);
      throw error;
    }
  };

  const skipWithSampleData = async () => {
    if (!user) return;

    // Update local state first for immediate UI feedback
    setState(prev => ({
      ...prev,
      inGuidedSetup: false,
      guidedSetupSkipped: true,
    }));

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          guided_setup_skipped: true,
          in_guided_setup: false 
        })
        .eq('user_id', user.id);

      if (error) {
        // Revert local state if database update fails
        setState(prev => ({
          ...prev,
          inGuidedSetup: false,
          guidedSetupSkipped: false,
        }));
        throw error;
      }
    } catch (error) {
      console.error('Error skipping setup:', error);
      throw error;
    }
  };

  const resetOnboardingState = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('reset_guided_setup', {
        user_uuid: user.id
      });

      if (error) throw error;

      setState({
        inGuidedSetup: false,  // Changed to false so modal shows
        guidedSetupSkipped: false,
        guidanceCompleted: false,
        currentStep: 1,
        completedSteps: [],
        loading: false
      });
    } catch (error) {
      console.error('Error resetting onboarding state:', error);
    }
  };

  const advanceStep = async (stepNumber: number) => {
    if (!user) return;

    console.log(`🚀 Advancing step ${stepNumber}...`);
    
    try {
      const { error } = await supabase.rpc('advance_guided_step', {
        user_uuid: user.id,
        step_number: stepNumber
      });

      if (error) {
        console.error('❌ RPC Error:', error);
        throw error;
      }

      console.log(`✅ RPC call successful for step ${stepNumber}`);

      // Add a small delay to ensure DB changes are committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Immediately refetch the state to update UI
      await fetchOnboardingState();

      console.log('✅ State refreshed after step completion');
    } catch (error) {
      console.error('❌ Error advancing guided step:', error);
      throw error;
    }
  };

  return {
    ...state,
    shouldShowOnboarding: shouldShowOnboarding(),
    startGuidedSetup,
    skipWithSampleData,
    resetOnboardingState,
    advanceStep,
    refreshState: fetchOnboardingState
  };
}