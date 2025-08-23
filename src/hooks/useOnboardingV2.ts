import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Single source of truth for onboarding stages - V3 with bulletproof state management
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
  sessionModalShown: boolean; // V3: Prevent multiple modal displays per session
}

// Import and run the V3 bulletproof test in development
import { runOnboardingBulletproofTestV3 } from "@/hooks/useOnboardingBulletproofTest";

export function useOnboardingV2() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    stage: 'not_started',
    currentStep: 1,
    loading: true,
    sessionModalShown: false // V3: Track modal display per session
  });

  // Run V3 bulletproof test in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      runOnboardingBulletproofTestV3();
    }
  }, []);

  const fetchState = async () => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    console.log('🔄 fetchState: Starting fetch for user', user.id);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('onboarding_stage, current_onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('🔄 fetchState: Database error:', error);
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      if (!data) {
        console.log('🔄 fetchState: No user settings, creating defaults...');
        // Create default settings for new user
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            onboarding_stage: 'not_started',
            current_onboarding_step: 1
          });

        if (insertError) {
          console.error('🔄 fetchState: Error creating user settings:', insertError);
        }

        console.log('🔄 fetchState: Setting state to not_started');
        setState({
          stage: 'not_started',
          currentStep: 1,
          loading: false,
          sessionModalShown: false
        });
        return;
      }

      // Bulletproof: Validate and sanitize data from database
      const stage = data.onboarding_stage as OnboardingStage;
      let currentStep = data.current_onboarding_step || 1;
      
      // Ensure step is within valid range
      if (currentStep < 1) currentStep = 1;
      if (currentStep > TOTAL_STEPS + 1) currentStep = TOTAL_STEPS + 1;

      console.log('🔄 fetchState: Setting state from database:', { stage, currentStep });
      setState({
        stage,
        currentStep,
        loading: false,
        sessionModalShown: false
      });

    } catch (error) {
      console.error('🔄 fetchState: Unexpected error:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Only fetch state once when user changes - prevent race conditions
  useEffect(() => {
    console.log('🔄 useOnboardingV2: User effect triggered, user:', user?.id);
    if (user) {
      fetchState();
    } else {
      setState({ stage: 'not_started', currentStep: 1, loading: false, sessionModalShown: false });
    }
  }, [user?.id]); // Only depend on user ID to prevent infinite loops

  // V3: Bulletproof modal display logic with session tracking
  const shouldShowWelcomeModal = () => {
    const result = !state.loading && 
                   state.stage === 'not_started' && 
                   !state.sessionModalShown;
    console.log('🎯 V3 shouldShowWelcomeModal:', { 
      loading: state.loading, 
      stage: state.stage, 
      sessionModalShown: state.sessionModalShown,
      result 
    });
    return result;
  };

  const isInGuidedSetup = () => {
    return state.stage === 'in_progress';
  };

  const isOnboardingComplete = () => {
    return state.stage === 'completed' || state.stage === 'skipped';
  };

  const shouldLockNavigation = () => {
    const result = state.stage === 'in_progress';
    console.log('🔒 shouldLockNavigation:', { 
      stage: state.stage, 
      result 
    });
    return result;
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

  // V3: Enhanced state transition functions with bulletproof error handling
  const startGuidedSetup = async () => {
    if (!user) return;
    
    console.log('🚀 V3 startGuidedSetup: Starting guided setup');

    try {
      // First update database
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          onboarding_stage: 'in_progress',
          current_onboarding_step: 1
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Then update state atomically with session tracking
      setState(prev => {
        console.log('🚀 V3 startGuidedSetup: State updated to in_progress with session tracking');
        return {
          ...prev,
          stage: 'in_progress',
          currentStep: 1,
          sessionModalShown: true // Mark modal as shown
        };
      });
    } catch (error) {
      console.error('❌ V3 startGuidedSetup: Error starting guided setup:', error);
      throw error;
    }
  };

  // V3: Mark modal as shown without starting guided setup (for restart flow)
  const markModalShown = () => {
    console.log('🎯 V3 markModalShown: Marking modal as shown for this session');
    setState(prev => ({
      ...prev,
      sessionModalShown: true
    }));
  };

  const completeCurrentStep = async () => {
    if (!user || state.stage !== 'in_progress') return;

    const nextStep = state.currentStep + 1;
    
    try {
      // Bulletproof: Prevent completing beyond total steps
      if (state.currentStep >= TOTAL_STEPS) {
        console.warn('Attempted to complete step beyond total steps');
        return;
      }

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

    console.log('🎯 completeOnboarding: Starting to complete onboarding');
    try {
      console.log('🎯 completeOnboarding: Updating database...');
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          onboarding_stage: 'completed',
          current_onboarding_step: TOTAL_STEPS + 1
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('🎯 completeOnboarding: Database error:', error);
        throw error;
      }

      console.log('🎯 completeOnboarding: Database updated successfully, updating state...');
      setState(prev => {
        console.log('🎯 completeOnboarding: State updated to completed');
        return {
          ...prev,
          stage: 'completed',
          currentStep: TOTAL_STEPS + 1
        };
      });
      console.log('🎯 completeOnboarding: Function completed successfully');
    } catch (error) {
      console.error('🎯 completeOnboarding: Error completing onboarding:', error);
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

  // V3: Enhanced reset with direct guided setup start (bypass modal)
  const resetOnboarding = async () => {
    if (!user) return;

    console.log('🔄 V3 resetOnboarding: Resetting and starting guided setup directly');
    try {
      // Directly set to in_progress to bypass modal
      await supabase
        .from('user_settings')
        .update({
          onboarding_stage: 'in_progress',
          current_onboarding_step: 1
        })
        .eq('user_id', user.id);

      setState({
        stage: 'in_progress',
        currentStep: 1,
        loading: false,
        sessionModalShown: true // Prevent modal from showing
      });
      console.log('🔄 V3 resetOnboarding: Reset completed, directly in guided setup');
    } catch (error) {
      console.error('❌ V3 resetOnboarding: Error resetting onboarding:', error);
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
    resetOnboarding,
    markModalShown // V3: New action to mark modal as shown
  };
}