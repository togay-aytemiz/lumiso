import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingV2 } from "./useOnboardingV2";

interface UseTutorialExitOptions {
  currentStepTitle?: string;
  onExitComplete?: () => void;
}

export function useTutorialExit({ currentStepTitle, onExitComplete }: UseTutorialExitOptions = {}) {
  const [showExitGuard, setShowExitGuard] = useState(false);
  const navigate = useNavigate();
  const { skipOnboarding } = useOnboardingV2();

  const handleExitRequest = () => {
    setShowExitGuard(true);
  };

  const handleStay = () => {
    setShowExitGuard(false);
  };

  const handleReturnToGettingStarted = () => {
    setShowExitGuard(false);
    navigate("/getting-started");
    onExitComplete?.();
  };

  const handleSkipSetup = () => {
    setShowExitGuard(false);
    skipOnboarding();
    navigate("/");
    onExitComplete?.();
  };

  return {
    showExitGuard,
    currentStepTitle,
    handleExitRequest,
    handleStay,
    handleReturnToGettingStarted,
    handleSkipSetup
  };
}