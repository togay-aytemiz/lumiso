import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { SettingsStickyFooter } from "./SettingsStickyFooter";
import { useToast } from "@/hooks/use-toast";

interface SettingsPageWrapperProps {
  children: ReactNode;
}

export default function SettingsPageWrapper({ children }: SettingsPageWrapperProps) {
  const location = useLocation();
  const { hasCategoryChanges, saveCategoryChanges, cancelCategoryChanges } = useSettingsContext();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const categoryPath = location.pathname;
  const hasChanges = hasCategoryChanges(categoryPath);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCategoryChanges(categoryPath);
      setShowSuccess(true);
      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully.",
      });
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save category changes:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    cancelCategoryChanges(categoryPath);
    toast({
      title: "Changes discarded",
      description: "Your unsaved changes have been discarded.",
    });
  };

  return (
    <>
      <div className="p-4 sm:p-6 md:p-8 w-full">
        {children}
      </div>
      
      <SettingsStickyFooter
        show={hasChanges}
        isSaving={isSaving}
        showSuccess={showSuccess}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
}