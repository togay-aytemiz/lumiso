import { useContext } from "react";
import { OnboardingContext, type OnboardingContextValue } from "@/contexts/onboardingContextValue";

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
