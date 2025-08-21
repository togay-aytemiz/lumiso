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

  useEffect(() => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    const fetchOnboardingState = async () => {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('in_guided_setup, guided_setup_skipped, guidance_completed, current_step, completed_steps')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching onboarding state:', error);
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        const completedStepsArray = Array.isArray(data?.completed_steps) 
          ? data.completed_steps 
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
        inGuidedSetup: true,
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

  const advanceStep = async (stepNumber: number, skipStep: boolean = false) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('advance_guided_step', {
        user_uuid: user.id,
        step_number: stepNumber,
        skip_step: skipStep
      });

      if (error) throw error;

      // Refresh state to get updated values
      const { data } = await supabase
        .from('user_settings')
        .select('in_guided_setup, guided_setup_skipped, guidance_completed, current_step, completed_steps')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const completedStepsArray = Array.isArray(data.completed_steps) 
          ? data.completed_steps 
          : [];

        setState({
          inGuidedSetup: data.in_guided_setup || false,
          guidedSetupSkipped: data.guided_setup_skipped || false,
          guidanceCompleted: data.guidance_completed || false,
          currentStep: data.current_step || 1,
          completedSteps: completedStepsArray,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error advancing step:', error);
    }
  };

  const setStep = async (stepNumber: number) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('set_guided_step', {
        user_uuid: user.id,
        target_step: stepNumber
      });

      if (error) throw error;

      // Refresh state to get updated values
      const { data } = await supabase
        .from('user_settings')
        .select('in_guided_setup, guided_setup_skipped, guidance_completed, current_step, completed_steps')
        .eq('user_id', user.id)
        .single();

      if (data) {
        const completedStepsArray = Array.isArray(data.completed_steps) 
          ? data.completed_steps 
          : [];

        setState({
          inGuidedSetup: data.in_guided_setup || false,
          guidedSetupSkipped: data.guided_setup_skipped || false,
          guidanceCompleted: data.guidance_completed || false,
          currentStep: data.current_step || 1,
          completedSteps: completedStepsArray,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error setting step:', error);
    }
  };

  return {
    ...state,
    shouldShowOnboarding: shouldShowOnboarding(),
    startGuidedSetup,
    skipWithSampleData,
    resetOnboardingState,
    advanceStep,
    setStep
  };
}