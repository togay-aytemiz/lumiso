import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface OnboardingState {
  inGuidedSetup: boolean;
  guidedSetupSkipped: boolean;
  guidanceCompleted: boolean;
  loading: boolean;
}

export function useOnboarding() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    inGuidedSetup: false,
    guidedSetupSkipped: false,
    guidanceCompleted: false,
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
          .select('in_guided_setup, guided_setup_skipped, guidance_completed')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching onboarding state:', error);
          setState(prev => ({ ...prev, loading: false }));
          return;
        }

        setState({
          inGuidedSetup: data?.in_guided_setup || false,
          guidedSetupSkipped: data?.guided_setup_skipped || false,
          guidanceCompleted: data?.guidance_completed || false,
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
      console.log('shouldShowOnboarding: false - loading or no user', { loading: state.loading, user: !!user });
      return false;
    }
    
    // Don't show if user has completed or skipped guided setup
    if (state.guidedSetupSkipped || state.guidanceCompleted) {
      console.log('shouldShowOnboarding: false - skipped or completed', { 
        guidedSetupSkipped: state.guidedSetupSkipped, 
        guidanceCompleted: state.guidanceCompleted 
      });
      return false;
    }
    
    // Show if user hasn't started guided setup yet
    const shouldShow = !state.inGuidedSetup;
    console.log('shouldShowOnboarding:', shouldShow, 'inGuidedSetup:', state.inGuidedSetup);
    return shouldShow;
  };

  const startGuidedSetup = async () => {
    if (!user) return;

    console.log('startGuidedSetup: Starting...');
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          in_guided_setup: true,
          guided_setup_skipped: false 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('startGuidedSetup: Database updated, updating local state...');
      setState(prev => {
        const newState = {
          ...prev,
          inGuidedSetup: true,
          guidedSetupSkipped: false,
        };
        console.log('startGuidedSetup: New local state:', newState);
        return newState;
      });
      console.log('startGuidedSetup: Completed successfully');
    } catch (error) {
      console.error('Error starting guided setup:', error);
      throw error;
    }
  };

  const skipWithSampleData = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          guided_setup_skipped: true,
          in_guided_setup: false 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setState(prev => ({
        ...prev,
        inGuidedSetup: false,
        guidedSetupSkipped: true,
      }));
    } catch (error) {
      console.error('Error skipping setup:', error);
      throw error;
    }
  };

  const resetOnboardingState = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          in_guided_setup: false,
          guided_setup_skipped: false,
          guidance_completed: false 
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setState({
        inGuidedSetup: false,
        guidedSetupSkipped: false,
        guidanceCompleted: false,
        loading: false
      });
    } catch (error) {
      console.error('Error resetting onboarding state:', error);
    }
  };

  return {
    ...state,
    shouldShowOnboarding,
    startGuidedSetup,
    skipWithSampleData,
    resetOnboardingState
  };
}