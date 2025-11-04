import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobile } from "./use-mobile";

interface NavigationGuardOptions {
  isDirty: boolean;
  onDiscard: () => void;
  onSaveAndExit?: () => Promise<void>;
  message?: string;
  navigationHandler?: (path: string | null) => void;
}

export function useSettingsNavigation({ 
  isDirty, 
  onDiscard, 
  onSaveAndExit,
  message = "You have unsaved changes. Do you want to discard them?",
  navigationHandler
}: NavigationGuardOptions) {
  const [showGuard, setShowGuard] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = useRef(location.pathname);
  const isMobile = useIsMobile();
  useEffect(() => {
    currentPath.current = location.pathname;
    // Clear any pending manual navigation when location updates
    setPendingNavigation(null);
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

  const handleModalClose = () => {
    if (isDirty) {
      setPendingNavigation(null);
      setShowGuard(true);
      return false; // Block close
    }
    return true; // Allow close
  };

  const clearPendingNavigation = () => {
    setPendingNavigation(null);
  };

  const proceedWithNavigation = () => {
    if (pendingNavigation !== null) {
      if (navigationHandler) {
        navigationHandler(pendingNavigation);
      } else if (pendingNavigation) {
        navigate(pendingNavigation);
      }
    } else if (navigationHandler) {
      navigationHandler(null);
    }
    clearPendingNavigation();
  };

  const handleDiscardChanges = () => {
    onDiscard();
    setShowGuard(false);
    proceedWithNavigation();
  };

  const handleStayOnPage = () => {
    setShowGuard(false);
    clearPendingNavigation();
  };

  const handleSaveAndExit = onSaveAndExit
    ? async () => {
        await onSaveAndExit();
        setShowGuard(false);
        proceedWithNavigation();
      }
    : undefined;

  return {
    showGuard,
    message,
    handleNavigationAttempt,
    handleModalClose,
    handleDiscardChanges,
    handleStayOnPage,
    handleSaveAndExit
  };
}
