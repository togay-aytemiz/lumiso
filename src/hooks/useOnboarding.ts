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

const GUIDED_STEPS = [
  { id: 1, title: "Complete your profile setup", description: "Add your name and contact information" },
  { id: 2, title: "Create your first client lead", description: "Add a potential client to your CRM" },
  { id: 3, title: "Set up a photography project", description: "Create your first project" },
  { id: 4, title: "Schedule a photo session", description: "Add a session to your calendar" },
  { id: 5, title: "Configure your packages", description: "Set up your service packages" }
];

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

        setState({
          inGuidedSetup: data?.in_guided_setup || false,
          guidedSetupSkipped: data?.guided_setup_skipped || false,
          guidanceCompleted: data?.guidance_completed || false,
          currentStep: data?.current_step || 1,
          completedSteps: Array.isArray(data?.completed_steps) 
            ? (data.completed_steps as number[]) 
            : [],
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

  const completeStep = async (stepNumber: number) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('advance_guided_step', {
        user_uuid: user.id,
        step_number: stepNumber,
        skip_step: false
      });

      if (error) throw error;

      // Update local state
      const newCompletedSteps = [...state.completedSteps];
      if (!newCompletedSteps.includes(stepNumber)) {
        newCompletedSteps.push(stepNumber);
      }

      const nextIncompleteStep = GUIDED_STEPS.find(step => 
        !newCompletedSteps.includes(step.id)
      );

      setState(prev => ({
        ...prev,
        completedSteps: newCompletedSteps,
        currentStep: nextIncompleteStep ? nextIncompleteStep.id : GUIDED_STEPS.length + 1,
        guidanceCompleted: newCompletedSteps.length >= GUIDED_STEPS.length,
        inGuidedSetup: newCompletedSteps.length < GUIDED_STEPS.length
      }));
    } catch (error) {
      console.error('Error completing step:', error);
      throw error;
    }
  };

  const skipStep = async (stepNumber: number) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('advance_guided_step', {
        user_uuid: user.id,
        step_number: stepNumber,
        skip_step: true
      });

      if (error) throw error;

      // Update local state (same as complete for now)
      const newCompletedSteps = [...state.completedSteps];
      if (!newCompletedSteps.includes(stepNumber)) {
        newCompletedSteps.push(stepNumber);
      }

      const nextIncompleteStep = GUIDED_STEPS.find(step => 
        !newCompletedSteps.includes(step.id)
      );

      setState(prev => ({
        ...prev,
        completedSteps: newCompletedSteps,
        currentStep: nextIncompleteStep ? nextIncompleteStep.id : GUIDED_STEPS.length + 1,
        guidanceCompleted: newCompletedSteps.length >= GUIDED_STEPS.length,
        inGuidedSetup: newCompletedSteps.length < GUIDED_STEPS.length
      }));
    } catch (error) {
      console.error('Error skipping step:', error);
      throw error;
    }
  };

  const resetGuidedSetup = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('reset_guided_setup', {
        user_uuid: user.id
      });

      if (error) throw error;

      setState(prev => ({
        ...prev,
        inGuidedSetup: true,
        guidedSetupSkipped: false,
        guidanceCompleted: false,
        currentStep: 1,
        completedSteps: []
      }));
    } catch (error) {
      console.error('Error resetting guided setup:', error);
      throw error;
    }
  };

  const jumpToStep = async (stepNumber: number) => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('set_guided_step', {
        user_uuid: user.id,
        target_step: stepNumber
      });

      if (error) throw error;

      const completedSteps = Array.from({ length: stepNumber - 1 }, (_, i) => i + 1);

      setState(prev => ({
        ...prev,
        inGuidedSetup: true,
        guidedSetupSkipped: false,
        guidanceCompleted: false,
        currentStep: stepNumber,
        completedSteps
      }));
    } catch (error) {
      console.error('Error jumping to step:', error);
      throw error;
    }
  };

  return {
    ...state,
    steps: GUIDED_STEPS,
    shouldShowOnboarding: shouldShowOnboarding(),
    startGuidedSetup,
    skipWithSampleData,
    completeStep,
    skipStep,
    resetGuidedSetup,
    jumpToStep
  };
}