import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettingsContext } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";

export function CategoryFloatingActionBar() {
  const location = useLocation();
  const categoryPath = location.pathname;
  const { hasCategoryChanges, saveCategoryChanges, cancelCategoryChanges, getCategoryDirtySections } = useSettingsContext();
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();

  const hasChanges = hasCategoryChanges(categoryPath);
  const dirtySections = getCategoryDirtySections(categoryPath);

  if (!hasChanges) return null;

  const handleSave = async () => {
    // Save category changes
    setIsSaving(true);
    try {
      await saveCategoryChanges(categoryPath);
      setShowSuccess(true);
      // Get category name from path
      const categoryName = categoryPath.split('/').pop()?.replace('-', ' ') || 'settings';
      
      toast({
        title: `Saved ${categoryName} settings`,
        duration: 3000,
      });

      setTimeout(() => {
        setShowSuccess(false);
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    cancelCategoryChanges(categoryPath);
  };

  return (
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 shadow-xl",
        "z-[200] transition-all duration-300 ease-in-out",
        "animate-slide-in-bottom"
      )}
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="text-sm text-muted-foreground">
          {dirtySections.length} section{dirtySections.length !== 1 ? 's' : ''} with unsaved changes
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isSaving}
            className="h-10 min-w-[80px]"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 min-w-[120px] flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : showSuccess ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}