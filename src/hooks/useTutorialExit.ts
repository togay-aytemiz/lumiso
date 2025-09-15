import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePortalReset } from "@/contexts/PortalResetContext";

interface UseTutorialExitOptions {
  currentStepTitle?: string;
  onExitComplete?: () => void;
}

export function useTutorialExit({ currentStepTitle, onExitComplete }: UseTutorialExitOptions = {}) {
  const [isExiting, setIsExiting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { reset } = usePortalReset();

  const handleExitNow = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    console.debug("[useTutorialExit] Long-press confirmed, exiting tutorial");
    try {
      onExitComplete?.();
    } finally {
      try { reset(); } catch {}
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (location.pathname !== "/getting-started") {
            navigate("/getting-started", { replace: true });
          }
          setTimeout(() => setIsExiting(false), 0);
        });
      });
    }
  }, [isExiting, onExitComplete, reset, location.pathname, navigate]);

  useEffect(() => {
    return () => setIsExiting(false);
  }, []);

  return {
    currentStepTitle,
    isExiting,
    handleExitNow
  };
}
