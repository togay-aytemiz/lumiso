import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { SettingsStickyFooter } from "./SettingsStickyFooter";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface SettingsPageWrapperProps {
  children: ReactNode;
}

export default function SettingsPageWrapper({ children }: SettingsPageWrapperProps) {
  const location = useLocation();
  const { hasCategoryChanges, saveCategoryChanges, cancelCategoryChanges } = useSettingsContext();
  const { toast } = useToast();
  const { t } = useTranslation('common');
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
        title: t('toast.settingsSavedTitle'),
        description: t('toast.settingsSavedDescription'),
      });
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save category changes:', error);
      toast({
        title: t('toast.error'),
        description: t('toast.settingsSaveErrorDescription'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    cancelCategoryChanges(categoryPath);
    toast({
      title: t('toast.settingsDiscardedTitle'),
      description: t('toast.settingsDiscardedDescription'),
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
