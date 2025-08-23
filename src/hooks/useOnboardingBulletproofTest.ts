// Onboarding system validation for development
import { ONBOARDING_STEPS, TOTAL_STEPS } from "./useOnboardingV2";

export const runOnboardingBulletproofTestV3 = () => {
  if (process.env.NODE_ENV !== 'development') return true;
  
  console.log('🔍 Onboarding System Validation');
  
  // Verify step definitions
  const stepsValid = TOTAL_STEPS === ONBOARDING_STEPS.length && 
    ONBOARDING_STEPS.every(step => step.id && step.title && step.route);
  
  console.log(`✅ Steps configured: ${stepsValid ? 'PASS' : 'FAIL'}`);
  
  return stepsValid;
};

// Development testing only
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testOnboardingV3 = runOnboardingBulletproofTestV3;
}