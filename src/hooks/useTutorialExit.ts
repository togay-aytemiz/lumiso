import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface UseTutorialExitOptions {
  currentStepTitle?: string;
  onExitComplete?: () => void;
}

export function useTutorialExit({ currentStepTitle, onExitComplete }: UseTutorialExitOptions = {}) {
  const [showExitGuard, setShowExitGuard] = useState(false);
  const navigate = useNavigate();
  const { skipOnboarding } = useOnboarding();

  const handleExitRequest = () => {
    setShowExitGuard(true);
  };

  const handleStay = () => {
    setShowExitGuard(false);
  };

  const handleReturnToGettingStarted = () => {
    setShowExitGuard(false);
    onExitComplete?.();
    requestAnimationFrame(() => {
      navigate("/getting-started", { replace: true });
    });
  };

  // Cleanup on unmount to prevent stale state
  useEffect(() => {
    return () => setShowExitGuard(false);
  }, []);

  return {
    showExitGuard,
    currentStepTitle,
    handleExitRequest,
    handleStay,
    handleReturnToGettingStarted
  };
}