import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { ONBOARDING_STEPS, TOTAL_STEPS, OnboardingStage } from "@/constants/onboarding";

const normalizeOnboardingStep = (step?: number | null) => {
  if (typeof step !== "number" || Number.isNaN(step)) return 1;
  const rounded = Math.round(step);
  const minimum = Math.max(1, rounded);
  return Math.min(minimum, TOTAL_STEPS + 1);
};

export interface OnboardingContextValue {
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

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { data: preferences, isLoading, updatePreferences } = useUserPreferences();
  const normalizationAttemptedRef = useRef(false);

  const normalizedCurrentStep = normalizeOnboardingStep(preferences?.currentOnboardingStep);
  const onboardingStage = preferences?.onboardingStage || 'not_started';
  const shouldAutoComplete = onboardingStage === 'in_progress' && normalizedCurrentStep > TOTAL_STEPS;
  const shouldRestoreInProgress =
    onboardingStage !== 'in_progress' &&
    normalizedCurrentStep > 1 &&
    normalizedCurrentStep <= TOTAL_STEPS;
  const stepNeedsNormalization =
    preferences &&
    preferences.currentOnboardingStep !== undefined &&
    normalizedCurrentStep !== preferences.currentOnboardingStep;

  // Auto-heal onboarding data when steps change (e.g., removed steps)
  useEffect(() => {
    if (!preferences || isLoading) return;
    if (!shouldAutoComplete && !stepNeedsNormalization && !shouldRestoreInProgress) return;
    if (normalizationAttemptedRef.current) return;

    normalizationAttemptedRef.current = true;
    const payload: { onboardingStage?: OnboardingStage; currentOnboardingStep?: number } = {};

    if (shouldAutoComplete) {
      payload.onboardingStage = 'completed';
      payload.currentOnboardingStep = TOTAL_STEPS + 1;
    } else {
      if (stepNeedsNormalization) {
        payload.currentOnboardingStep = normalizedCurrentStep;
      }
      if (shouldRestoreInProgress) {
        payload.onboardingStage = 'in_progress';
      }
    }

    updatePreferences(payload).catch(() => {
      // allow retry if the update fails
      normalizationAttemptedRef.current = false;
    });
  }, [preferences, isLoading, shouldAutoComplete, stepNeedsNormalization, shouldRestoreInProgress, normalizedCurrentStep, updatePreferences]);

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

    const { welcomeModalShown } = preferences;

    // BULLETPROOF: Modal shows ONLY if user has NEVER seen it
    const shouldShowWelcomeModal = onboardingStage === 'not_started' && !welcomeModalShown;
    
    const isInGuidedSetup = onboardingStage === 'in_progress';
    
    const isOnboardingComplete =
      onboardingStage === 'completed' || onboardingStage === 'skipped' || normalizedCurrentStep > TOTAL_STEPS;
    
    const shouldLockNavigation = onboardingStage === 'in_progress' && normalizedCurrentStep <= TOTAL_STEPS;

    // Step information
    const currentStepInfo = isInGuidedSetup && normalizedCurrentStep >= 1 && normalizedCurrentStep <= TOTAL_STEPS
      ? ONBOARDING_STEPS[normalizedCurrentStep - 1]
      : null;

    const nextStepInfo = isInGuidedSetup && normalizedCurrentStep < TOTAL_STEPS
      ? ONBOARDING_STEPS[normalizedCurrentStep]
      : null;

    const completedSteps = isInGuidedSetup 
      ? ONBOARDING_STEPS.slice(0, Math.min(normalizedCurrentStep - 1, TOTAL_STEPS))
      : [];

    const isAllStepsComplete = normalizedCurrentStep > TOTAL_STEPS;

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
  }, [preferences, isLoading, normalizedCurrentStep, onboardingStage]);

  // Action functions
  const startGuidedSetup = async () => {
    if (!preferences) return;
    
    // Starting guided setup - modal disabled for improved performance
    
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

    const safeCurrentStep = normalizeOnboardingStep(preferences.currentOnboardingStep);
    const nextStep = safeCurrentStep >= TOTAL_STEPS ? TOTAL_STEPS + 1 : safeCurrentStep + 1;
    // Completing current step and advancing to next

    await updatePreferences({
      currentOnboardingStep: nextStep
    });
  };

  const completeMultipleSteps = async (numberOfSteps: number) => {
    if (!preferences || preferences.onboardingStage !== 'in_progress') {
      console.warn("🚫 completeMultipleSteps: Cannot complete - not in progress");
      return;
    }

    const safeCurrentStep = normalizeOnboardingStep(preferences.currentOnboardingStep);
    const targetStep = safeCurrentStep + numberOfSteps;
    // Completing multiple steps in batch

    const finalStep = Math.min(targetStep, TOTAL_STEPS + 1);
    
    await updatePreferences({
      currentOnboardingStep: finalStep
    });
  };

  const completeOnboarding = async () => {
    if (!preferences) return;

    // Completing onboarding process
    
    await updatePreferences({
      onboardingStage: 'completed',
      currentOnboardingStep: TOTAL_STEPS + 1
    });
  };

  const skipOnboarding = async () => {
    if (!preferences) return;

    await updatePreferences({
      onboardingStage: 'skipped',
      currentOnboardingStep: TOTAL_STEPS + 1
    });
  };

  const resetOnboarding = async () => {
    if (!preferences) return;

    // Resetting onboarding to guided mode
    
    await updatePreferences({
      onboardingStage: 'in_progress',
      currentOnboardingStep: 1,
      welcomeModalShown: true // Keep modal permanently disabled
    });
  };

  const contextValue: OnboardingContextValue = {
    // State
    stage: onboardingStage,
    currentStep: normalizedCurrentStep,
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

export function useOptionalOnboarding(): OnboardingContextValue | null {
  return useContext(OnboardingContext);
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
