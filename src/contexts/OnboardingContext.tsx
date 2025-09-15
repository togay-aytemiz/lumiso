import React, { createContext, useContext, useMemo } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { ONBOARDING_STEPS, TOTAL_STEPS, OnboardingStage } from "@/constants/onboarding";

interface OnboardingContextValue {
  // State
  stage: OnboardingStage;
  currentStep: number;
  loading: boolean;
  
  // Computed values (memoized for performance)
  shouldShowWelcomeModal: boolean;
  isInGuidedSetup: boolean;
  isOnboardingComplete: boolean;
  shouldLockNavigation: boolean;
  
  // Step information
  currentStepInfo: (typeof ONBOARDING_STEPS)[number] | null;
  nextStepInfo: (typeof ONBOARDING_STEPS)[number] | null;
  completedSteps: (typeof ONBOARDING_STEPS)[number][];
  isAllStepsComplete: boolean;
  totalSteps: number;
  
  // Actions
  startGuidedSetup: () => Promise<void>;
  completeCurrentStep: () => Promise<void>;
  completeMultipleSteps: (numberOfSteps: number) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  skipOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { data: preferences, isLoading, updatePreferences } = useUserPreferences();

  // Memoized computed values to prevent excessive recalculations
  const computedValues = useMemo(() => {
    if (!preferences || isLoading) {
      return {
        shouldShowWelcomeModal: false,
        isInGuidedSetup: false,
        isOnboardingComplete: false,
        shouldLockNavigation: false,
        currentStepInfo: null,
        nextStepInfo: null,
        completedSteps: [],
        isAllStepsComplete: false
      };
    }

    const { onboardingStage, currentOnboardingStep, welcomeModalShown } = preferences;

    // BULLETPROOF: Modal shows ONLY if user has NEVER seen it
    const shouldShowWelcomeModal = onboardingStage === 'not_started' && !welcomeModalShown;
    
    const isInGuidedSetup = onboardingStage === 'in_progress';
    
    const isOnboardingComplete = onboardingStage === 'completed' || onboardingStage === 'skipped';
    
    const shouldLockNavigation = onboardingStage === 'in_progress';

    // Step information
    const currentStepInfo = isInGuidedSetup && currentOnboardingStep >= 1 && currentOnboardingStep <= TOTAL_STEPS
      ? ONBOARDING_STEPS[currentOnboardingStep - 1]
      : null;

    const nextStepInfo = isInGuidedSetup && currentOnboardingStep < TOTAL_STEPS
      ? ONBOARDING_STEPS[currentOnboardingStep]
      : null;

    const completedSteps = isInGuidedSetup 
      ? ONBOARDING_STEPS.slice(0, currentOnboardingStep - 1)
      : [];

    const isAllStepsComplete = isInGuidedSetup && currentOnboardingStep > TOTAL_STEPS;

    return {
      shouldShowWelcomeModal,
      isInGuidedSetup,
      isOnboardingComplete,
      shouldLockNavigation,
      currentStepInfo,
      nextStepInfo,
      completedSteps,
      isAllStepsComplete
    };
  }, [preferences, isLoading]);

  // Action functions
  const startGuidedSetup = async () => {
    if (!preferences) return;
    
    console.log("🚀 BULLETPROOF startGuidedSetup: Starting - modal PERMANENTLY disabled");
    
    await updatePreferences({
      onboardingStage: 'in_progress',
      currentOnboardingStep: 1,
      welcomeModalShown: true // PERMANENT - NEVER reset
    });
  };

  const completeCurrentStep = async () => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') {
      console.warn("🚫 completeCurrentStep: Cannot complete - not in progress");
      return;
    }

    const nextStep = preferences.currentOnboardingStep + 1;
    console.log("🎯 completeCurrentStep: Completing step", {
      currentStep: preferences.currentOnboardingStep,
      nextStep,
      totalSteps: TOTAL_STEPS
    });

    // Bulletproof: Prevent completing beyond total steps
    if (preferences.currentOnboardingStep >= TOTAL_STEPS) {
      console.warn("🚫 completeCurrentStep: Attempted to complete step beyond total steps");
      return;
    }

    await updatePreferences({
      currentOnboardingStep: nextStep
    });
  };

  const completeMultipleSteps = async (numberOfSteps: number) => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') {
      console.warn("🚫 completeMultipleSteps: Cannot complete - not in progress");
      return;
    }

    const targetStep = preferences.currentOnboardingStep + numberOfSteps;
    console.log("🎯 completeMultipleSteps: Completing multiple steps", {
      currentStep: preferences.currentOnboardingStep,
      numberOfSteps,
      targetStep,
      totalSteps: TOTAL_STEPS
    });

    // Prevent completing beyond total steps
    if (preferences.currentOnboardingStep >= TOTAL_STEPS) {
      console.warn("🚫 completeMultipleSteps: Already at or beyond total steps");
      return;
    }

    const finalStep = Math.min(targetStep, TOTAL_STEPS + 1);
    
    await updatePreferences({
      currentOnboardingStep: finalStep
    });
  };

  const completeOnboarding = async () => {
    if (!preferences) return;

    console.log("🎯 completeOnboarding: Starting to complete onboarding");
    
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

  const resetOnboarding = async () => {
    if (!preferences) return;

    console.log("🔄 BULLETPROOF resetOnboarding: Starting guided mode without modal");
    
    await updatePreferences({
      onboardingStage: 'in_progress',
      currentOnboardingStep: 1,
      welcomeModalShown: true // Keep modal permanently disabled
    });
  };

  const contextValue: OnboardingContextValue = {
    // State
    stage: preferences?.onboardingStage || 'not_started',
    currentStep: preferences?.currentOnboardingStep || 1,
    loading: isLoading,
    
    // Computed values (memoized)
    ...computedValues,
    totalSteps: TOTAL_STEPS,
    
    // Actions
    startGuidedSetup,
    completeCurrentStep,
    completeMultipleSteps,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}