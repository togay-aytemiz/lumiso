import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "./use-mobile";

interface NavigationGuardOptions {
  isDirty: boolean;
  onDiscard: () => void;
  onSaveAndExit?: () => Promise<void>;
  message?: string;
}

export function useSettingsNavigation({ 
  isDirty, 
  onDiscard, 
  onSaveAndExit,
  message = "You have unsaved changes. Do you want to discard them?" 
}: NavigationGuardOptions) {
  const [showGuard, setShowGuard] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = useRef(location.pathname);
  const isMobile = useIsMobile();

  useEffect(() => {
    currentPath.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    // Only use browser guard on mobile devices
    if (isDirty && isMobile) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message, isMobile]);

  const handleNavigationAttempt = (path: string) => {
    if (isDirty && path !== currentPath.current) {
      setPendingNavigation(path);
      setShowGuard(true);
      return false;
    }
    return true;
  };

  const handleDiscardChanges = () => {
    onDiscard();
    setShowGuard(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const handleStayOnPage = () => {
    setShowGuard(false);
    setPendingNavigation(null);
  };

  const handleSaveAndExit = async () => {
    if (onSaveAndExit) {
      await onSaveAndExit();
    }
    setShowGuard(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  return {
    showGuard,
    message,
    handleNavigationAttempt,
    handleDiscardChanges,
    handleStayOnPage,
    handleSaveAndExit
  };
}