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
  welcomeModalShown: boolean; // PERMANENT: Once true, NEVER reset
}

// Import and run the V3 bulletproof test in development
import { runOnboardingBulletproofTestV3 } from "@/hooks/useOnboardingBulletproofTest";

export function useOnboardingV2() {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    stage: 'not_started',
    currentStep: 1,
    loading: true,
    welcomeModalShown: false // Will be loaded from database
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
        .select('onboarding_stage, current_onboarding_step, welcome_modal_shown')
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
            current_onboarding_step: 1,
            welcome_modal_shown: false
          });

        if (insertError) {
          console.error('🔄 fetchState: Error creating user settings:', insertError);
        }

        console.log('🔄 fetchState: Setting state to not_started');
        setState({
          stage: 'not_started',
          currentStep: 1,
          loading: false,
          welcomeModalShown: false
        });
        return;
      }

      // Bulletproof: Validate and sanitize data from database
      const stage = data.onboarding_stage as OnboardingStage;
      let currentStep = data.current_onboarding_step || 1;
      const welcomeModalShown = data.welcome_modal_shown || false;
      
      // Ensure step is within valid range
      if (currentStep < 1) currentStep = 1;
      if (currentStep > TOTAL_STEPS + 1) currentStep = TOTAL_STEPS + 1;

      console.log('🔄 fetchState: Setting state from database:', { stage, currentStep, welcomeModalShown });
      setState({
        stage,
        currentStep,
        loading: false,
        welcomeModalShown
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
      setState({ stage: 'not_started', currentStep: 1, loading: false, welcomeModalShown: false });
    }
  }, [user?.id]); // Only depend on user ID to prevent infinite loops

  // BULLETPROOF: Modal shows ONLY if user has NEVER seen it
  const shouldShowWelcomeModal = () => {
    const result = !state.loading && 
                   state.stage === 'not_started' && 
                   !state.welcomeModalShown;
    console.log('🎯 BULLETPROOF shouldShowWelcomeModal:', { 
      loading: state.loading, 
      stage: state.stage,
      welcomeModalShown: state.welcomeModalShown,
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
    return state.stage === 'completed' || (state.stage === 'in_progress' && state.currentStep > TOTAL_STEPS);
  };

  // BULLETPROOF: Mark modal as shown PERMANENTLY
  const startGuidedSetup = async () => {
    if (!user) return;
    
    console.log('🚀 BULLETPROOF startGuidedSetup: Starting - modal PERMANENTLY disabled');

    try {
      // Update database - mark modal as shown FOREVER
      const { error } = await supabase
        .from('user_settings')
        .update({ 
          onboarding_stage: 'in_progress',
          current_onboarding_step: 1,
          welcome_modal_shown: true  // PERMANENT - NEVER reset
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Update state - modal disabled forever
      setState(prev => {
        console.log('🚀 BULLETPROOF: Modal PERMANENTLY disabled');
        return {
          ...prev,
          stage: 'in_progress',
          currentStep: 1,
          welcomeModalShown: true // NEVER reset
        };
      });
    } catch (error) {
      console.error('❌ BULLETPROOF startGuidedSetup: Error:', error);
      throw error;
    }
  };

  // Enhanced step completion with better debugging
  const completeCurrentStep = async () => {
    if (!user || state.stage !== 'in_progress') {
      console.warn('🚫 completeCurrentStep: Cannot complete - user missing or not in progress', {
        user: !!user,
        stage: state.stage
      });
      return;
    }

    const nextStep = state.currentStep + 1;
    console.log('🎯 V3 completeCurrentStep: Completing step', {
      currentStep: state.currentStep,
      nextStep,
      totalSteps: TOTAL_STEPS
    });
    
    try {
      // Bulletproof: Prevent completing beyond total steps
      if (state.currentStep > TOTAL_STEPS) {
        console.warn('🚫 completeCurrentStep: Attempted to complete step beyond total steps');
        return;
      }

      await supabase
        .from('user_settings')
        .update({ 
          current_onboarding_step: nextStep
        })
        .eq('user_id', user.id);

      setState(prev => {
        console.log('🎯 V3 completeCurrentStep: State updated', {
          from: prev.currentStep,
          to: nextStep
        });
        return {
          ...prev,
          currentStep: nextStep
        };
      });
    } catch (error) {
      console.error('❌ V3 completeCurrentStep: Error completing step:', error);
      throw error;
    }
  };

  // BULLETPROOF: Complete multiple steps at once (for combined tutorials)
  const completeMultipleSteps = async (numberOfSteps: number) => {
    if (!user || state.stage !== 'in_progress') {
      console.warn('🚫 completeMultipleSteps: Cannot complete - user missing or not in progress');
      return;
    }

    const targetStep = state.currentStep + numberOfSteps;
    console.log('🎯 BULLETPROOF completeMultipleSteps: Completing multiple steps', {
      currentStep: state.currentStep,
      numberOfSteps,
      targetStep,
      totalSteps: TOTAL_STEPS
    });
    
    try {
      // Prevent completing beyond total steps
      if (state.currentStep > TOTAL_STEPS) {
        console.warn('🚫 completeMultipleSteps: Already at or beyond total steps');
        return;
      }

      const finalStep = Math.min(targetStep, TOTAL_STEPS + 1);
      
      await supabase
        .from('user_settings')
        .update({ 
          current_onboarding_step: finalStep
        })
        .eq('user_id', user.id);

      setState(prev => {
        console.log('🎯 BULLETPROOF completeMultipleSteps: State updated', {
          from: prev.currentStep,
          to: finalStep
        });
        return {
          ...prev,
          currentStep: finalStep
        };
      });
    } catch (error) {
      console.error('❌ BULLETPROOF completeMultipleSteps: Error:', error);
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

  // Reset for restart: START guided mode but keep modal permanently disabled
  const resetOnboarding = async () => {
    if (!user) return;

    console.log('🔄 BULLETPROOF resetOnboarding: Starting guided mode without modal');
    try {
      // Set to in_progress to actually start guided mode
      await supabase
        .from('user_settings')
        .update({
          onboarding_stage: 'in_progress',  // Actually start guided mode
          current_onboarding_step: 1,
          welcome_modal_shown: true         // Keep modal permanently disabled
        })
        .eq('user_id', user.id);

      setState({
        stage: 'in_progress',      // Actually in guided mode now
        currentStep: 1,
        loading: false,
        welcomeModalShown: true    // Modal stays disabled
      });
      console.log('🔄 BULLETPROOF resetOnboarding: Guided mode STARTED, modal STAYS disabled');
    } catch (error) {
      console.error('❌ BULLETPROOF resetOnboarding: Error:', error);
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
    completeMultipleSteps, // BULLETPROOF: For combined tutorials
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
}