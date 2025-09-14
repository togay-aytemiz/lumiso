import { useUserPreferences } from "./useUserPreferences";

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

/**
 * DEPRECATED: This hook is being replaced by the OnboardingProvider context.
 * For new code, use useOnboarding() from OnboardingContext instead.
 * This hook is kept for backward compatibility during migration.
 */
export function useOnboardingV2() {
  const { data: preferences, isLoading, updatePreferences } = useUserPreferences();

  // BULLETPROOF: Modal shows ONLY if user has NEVER seen it (memoized for performance)
  const shouldShowWelcomeModal = () => {
    if (!preferences || isLoading) return false;
    return preferences.onboardingStage === 'not_started' && !preferences.welcomeModalShown;
  };

  const isInGuidedSetup = () => {
    if (!preferences) return false;
    return preferences.onboardingStage === 'in_progress';
  };

  const isOnboardingComplete = () => {
    if (!preferences) return false;
    return preferences.onboardingStage === 'completed' || preferences.onboardingStage === 'skipped';
  };

  const shouldLockNavigation = () => {
    if (!preferences) return false;
    return preferences.onboardingStage === 'in_progress';
  };

  // Get current step info
  const getCurrentStepInfo = () => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') return null;
    
    const stepIndex = preferences.currentOnboardingStep - 1;
    if (stepIndex < 0 || stepIndex >= ONBOARDING_STEPS.length) return null;
    
    return ONBOARDING_STEPS[stepIndex];
  };

  const getNextStepInfo = () => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') return null;
    
    const nextStepIndex = preferences.currentOnboardingStep;
    if (nextStepIndex >= ONBOARDING_STEPS.length) return null;
    
    return ONBOARDING_STEPS[nextStepIndex];
  };

  const getCompletedSteps = () => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') return [];
    return ONBOARDING_STEPS.slice(0, preferences.currentOnboardingStep - 1);
  };

  const isAllStepsComplete = () => {
    if (!preferences) return false;
    return preferences.onboardingStage === 'in_progress' && preferences.currentOnboardingStep > TOTAL_STEPS;
  };

  // BULLETPROOF: Mark modal as shown PERMANENTLY
  const startGuidedSetup = async () => {
    if (!preferences) return;
    
    console.log('🚀 BULLETPROOF startGuidedSetup: Starting - modal PERMANENTLY disabled');

    await updatePreferences({
      onboardingStage: 'in_progress',
      currentOnboardingStep: 1,
      welcomeModalShown: true // PERMANENT - NEVER reset
    });
  };

  // Enhanced step completion with better debugging
  const completeCurrentStep = async () => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') {
      console.warn('🚫 completeCurrentStep: Cannot complete - not in progress');
      return;
    }

    const nextStep = preferences.currentOnboardingStep + 1;
    console.log('🎯 completeCurrentStep: Completing step', {
      currentStep: preferences.currentOnboardingStep,
      nextStep,
      totalSteps: TOTAL_STEPS
    });
    
    // Bulletproof: Prevent completing beyond total steps
    if (preferences.currentOnboardingStep >= TOTAL_STEPS) {
      console.warn('🚫 completeCurrentStep: Attempted to complete step beyond total steps');
      return;
    }

    await updatePreferences({
      currentOnboardingStep: nextStep
    });
  };

  // BULLETPROOF: Complete multiple steps at once (for combined tutorials)
  const completeMultipleSteps = async (numberOfSteps: number) => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') {
      console.warn('🚫 completeMultipleSteps: Cannot complete - not in progress');
      return;
    }

    const targetStep = preferences.currentOnboardingStep + numberOfSteps;
    console.log('🎯 completeMultipleSteps: Completing multiple steps', {
      currentStep: preferences.currentOnboardingStep,
      numberOfSteps,
      targetStep,
      totalSteps: TOTAL_STEPS
    });
    
    // Prevent completing beyond total steps
    if (preferences.currentOnboardingStep >= TOTAL_STEPS) {
      console.warn('🚫 completeMultipleSteps: Already at or beyond total steps');
      return;
    }

    const finalStep = Math.min(targetStep, TOTAL_STEPS + 1);
    
    await updatePreferences({
      currentOnboardingStep: finalStep
    });
  };

  const completeOnboarding = async () => {
    if (!preferences) return;

    console.log('🎯 completeOnboarding: Starting to complete onboarding');
    
    await updatePreferences({
      onboardingStage: 'completed',
      currentOnboardingStep: TOTAL_STEPS + 1
    });
  };

  const skipOnboarding = async () => {
    if (!preferences) return;

    await updatePreferences({
      onboardingStage: 'skipped'
    });
  };

  // Reset for restart: START guided mode but keep modal permanently disabled
  const resetOnboarding = async () => {
    if (!preferences) return;

    console.log('🔄 BULLETPROOF resetOnboarding: Starting guided mode without modal');
    
    await updatePreferences({
      onboardingStage: 'in_progress',
      currentOnboardingStep: 1,
      welcomeModalShown: true // Keep modal permanently disabled
    });
  };

  return {
    // State
    stage: preferences?.onboardingStage || 'not_started',
    currentStep: preferences?.currentOnboardingStep || 1,
    loading: isLoading,
    
    // Computed values (NO more console.log spam!)
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
    completeMultipleSteps,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };
}