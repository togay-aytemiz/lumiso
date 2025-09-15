import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { usePortalReset } from "@/contexts/PortalResetContext";

interface UseTutorialExitOptions {
  currentStepTitle?: string;
  onExitComplete?: () => void;
}

export function useTutorialExit({ currentStepTitle, onExitComplete }: UseTutorialExitOptions = {}) {
  const [showExitGuard, setShowExitGuard] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { skipOnboarding } = useOnboarding();
  const { reset } = usePortalReset();

  const handleExitRequest = () => {
    if (isExiting) return;
    setShowExitGuard(true);
  };

  const handleStay = () => {
    setShowExitGuard(false);
  };

  const handleReturnToGettingStarted = () => {
    if (isExiting) return;
    setIsExiting(true);
    setShowExitGuard(false);
    console.debug("[useTutorialExit] Exiting tutorial and returning to /getting-started");
    try {
      onExitComplete?.();
    } finally {
      // Force remount of all Radix portals before navigating
      try { reset(); } catch {}
      // Defer navigation to allow all portals to unmount cleanly
      setTimeout(() => {
        if (location.pathname !== "/getting-started") {
          navigate("/getting-started", { replace: true });
        }
        // Release the lock on the next tick to avoid double-actions
        setTimeout(() => setIsExiting(false), 0);
      }, 0);
    }
  };

  // Cleanup on unmount to prevent stale state
  useEffect(() => {
    return () => setShowExitGuard(false);
  }, []);

  return {
    showExitGuard,
    currentStepTitle,
    isExiting,
    handleExitRequest,
    handleStay,
    handleReturnToGettingStarted
  };
}