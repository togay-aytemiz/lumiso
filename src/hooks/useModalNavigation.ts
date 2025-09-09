import { useState } from "react";

interface ModalNavigationOptions {
  isDirty: boolean;
  onDiscard: () => void;
  onSaveAndExit?: () => Promise<void>;
  message?: string;
}

export function useModalNavigation({ 
  isDirty, 
  onDiscard, 
  onSaveAndExit,
  message = "You have unsaved changes. Do you want to discard them?" 
}: ModalNavigationOptions) {
  const [showGuard, setShowGuard] = useState(false);

  const handleModalClose = () => {
    if (isDirty) {
      setShowGuard(true);
      return false; // Block close
    }
    return true; // Allow close
  };

  const handleDiscardChanges = () => {
    onDiscard();
    setShowGuard(false);
  };

  const handleStayOnModal = () => {
    setShowGuard(false);
  };

  const handleSaveAndExit = async () => {
    if (onSaveAndExit) {
      await onSaveAndExit();
    }
    setShowGuard(false);
  };

  return {
    showGuard,
    message,
    handleModalClose,
    handleDiscardChanges,
    handleStayOnModal,
    handleSaveAndExit
  };
}