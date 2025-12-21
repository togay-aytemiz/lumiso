import { createContext } from "react";
import { ONBOARDING_STEPS, type OnboardingStage } from "@/constants/onboarding";

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

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);
