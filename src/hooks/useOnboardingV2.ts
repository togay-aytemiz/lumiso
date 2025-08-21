import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Single source of truth for onboarding stages
export type OnboardingStage = 'not_started' | 'modal_shown' | 'in_progress' | 'completed' | 'skipped';

// Define onboarding steps in a single place - easy to modify in future
export const ONBOARDING_STEPS = [
  {
    id: 1,
    title: "Complete Your Profile Setup",
    description: "Add your business details and contact information",
    route: "/settings/profile",
    buttonText: "Set Up Profile",
    duration: "3 min"
  },
  {
    id: 2, 
    title: "Create Your First Lead",
    description: "Add a potential client to start tracking opportunities",
    route: "/leads",
    buttonText: "Go to Leads",
    duration: "2 min"
  },
  {
    id: 3,
    title: "Set Up a Photography Project", 
    description: "Create your first project to organize sessions and deliverables",
    route: "/projects",
    buttonText: "Create Project",
    duration: "4 min"
  },
  {
    id: 4,
    title: "Explore Projects Page",
    description: "Learn about different project views: Board, List, and Archived projects",
    route: "/projects?tutorial=true",
    buttonText: "Explore Projects",
    duration: "3 min"
  },
  {
    id: 5,
    title: "Schedule a Photo Session",
    description: "Book your first session and manage your calendar",
    route: "/leads?tutorial=scheduling", 
    buttonText: "Schedule Session",
    duration: "3 min"
  },
  {
    id: 6,
    title: "Configure Your Packages",
    description: "Set up photography packages and pricing structure",
    route: "/settings/services",
    buttonText: "Set Up Packages",
    duration: "5 min"
  }
] as const;

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

interface OnboardingState {
  stage: OnboardingStage;
  currentStep: number;
  loading: boolean;
}

export function useOnboardingV2() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    stage: 'not_started',
    currentStep: 1,
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
        .select('onboarding_stage, current_onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching onboarding state:', error);
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      if (!data) {
        // Create default settings for new user
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            onboarding_stage: 'not_started',
            current_onboarding_step: 1
          });

        if (insertError) {
          console.error('Error creating user settings:', insertError);
        }

        setState({
          stage: 'not_started',
          currentStep: 1,
          loading: false
        });
        return;
      }

      setState({
        stage: data.onboarding_stage as OnboardingStage,
        currentStep: data.current_onboarding_step || 1,
        loading: false
      });

    } catch (error) {
      console.error('Error fetching onboarding state:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchState();
  }, [user]);

  // Helper functions for determining what to show
  const shouldShowWelcomeModal = () => {
    return !state.loading && state.stage === 'not_started';
  };

  const isInGuidedSetup = () => {
    return state.stage === 'in_progress';
  };

  const isOnboardingComplete = () => {
    return state.stage === 'completed' || state.stage === 'skipped';
  };

  const shouldLockNavigation = () => {
    return state.stage === 'in_progress';
  };

  // Get current step info
  const getCurrentStepInfo = () => {
    if (state.stage !== 'in_progress') return null;
    
    const stepIndex = state.currentStep - 1;
    if (stepIndex < 0 || stepIndex >= ONBOARDING_STEPS.length) return null;
    
    return ONBOARDING_STEPS[stepIndex];
  };

  const getNextStepInfo = () => {
    if (state.stage !== 'in_progress') return null;
    
    const nextStepIndex = state.currentStep;
    if (nextStepIndex >= ONBOARDING_STEPS.length) return null;
    
    return ONBOARDING_STEPS[nextStepIndex];
  };

  const getCompletedSteps = () => {
    if (state.stage !== 'in_progress') return [];
    return ONBOARDING_STEPS.slice(0, state.currentStep - 1);
  };

  const isAllStepsComplete = () => {
    return state.stage === 'in_progress' && state.currentStep > TOTAL_STEPS;
  };

  // State transition functions
  const startGuidedSetup = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_settings')
        .update({ 
          onboarding_stage: 'in_progress',
          current_onboarding_step: 1
        })
        .eq('user_id', user.id);

      setState(prev => ({
        ...prev,
        stage: 'in_progress',
        currentStep: 1
      }));
    } catch (error) {
      console.error('Error starting guided setup:', error);
      throw error;
    }
  };

  const completeCurrentStep = async () => {
    if (!user || state.stage !== 'in_progress') return;

    const nextStep = state.currentStep + 1;
    
    try {
      await supabase
        .from('user_settings')
        .update({ 
          current_onboarding_step: nextStep
        })
        .eq('user_id', user.id);

      setState(prev => ({
        ...prev,
        currentStep: nextStep
      }));
    } catch (error) {
      console.error('Error completing step:', error);
      throw error;
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_settings')
        .update({ 
          onboarding_stage: 'completed',
          current_onboarding_step: TOTAL_STEPS + 1
        })
        .eq('user_id', user.id);

      setState(prev => ({
        ...prev,
        stage: 'completed',
        currentStep: TOTAL_STEPS + 1
      }));
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error;
    }
  };

  const skipOnboarding = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_settings')
        .update({ 
          onboarding_stage: 'skipped'
        })
        .eq('user_id', user.id);

      setState(prev => ({
        ...prev,
        stage: 'skipped'
      }));
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      throw error;
    }
  };

  const resetOnboarding = async () => {
    if (!user) return;

    try {
      await supabase
        .from('user_settings')
        .update({
          onboarding_stage: 'not_started',
          current_onboarding_step: 1
        })
        .eq('user_id', user.id);

      setState({
        stage: 'not_started',
        currentStep: 1,
        loading: false
      });
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  };

  return {
    // State
    stage: state.stage,
    currentStep: state.currentStep,
    loading: state.loading,
    
    // Computed values
    shouldShowWelcomeModal: shouldShowWelcomeModal(),
    isInGuidedSetup: isInGuidedSetup(),
    isOnboardingComplete: isOnboardingComplete(),
    shouldLockNavigation: shouldLockNavigation(),
    
    // Step information
    currentStepInfo: getCurrentStepInfo(),
    nextStepInfo: getNextStepInfo(),
    completedSteps: getCompletedSteps(),
    isAllStepsComplete: isAllStepsComplete(),
    totalSteps: TOTAL_STEPS,
    
    // Actions
    startGuidedSetup,
    completeCurrentStep,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
}