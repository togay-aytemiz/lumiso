import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import SettingsHeader from "@/components/settings/SettingsHeader";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Loader2, X, Building, Settings } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";

export default function General() {
  const { settings, loading, uploading, updateSettings, uploadLogo, deleteLogo } = useOrganizationSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { advanceStep } = useOnboarding();

  // Check if we're in tutorial mode
  const isInTutorial = searchParams.get('tutorial') === 'true';
  const [showTutorial, setShowTutorial] = useState(isInTutorial);

  // Branding section state
  const brandingSection = useSettingsCategorySection({
    sectionId: "branding",
    sectionName: "Branding",
    initialValues: {
      companyName: settings?.photography_business_name || "",
      brandColor: settings?.primary_brand_color || "#1EB29F"
    },
    onSave: async (values) => {
      // Save branding settings (logo uploads automatically on selection)
      const updates: any = {
        photography_business_name: values.companyName,
        primary_brand_color: values.brandColor
      };

      const result = await updateSettings(updates);
      if (!result.success) {
        throw new Error("Failed to save branding settings");
      }
    }
  });

  // Regional settings section state
  const regionalSection = useSettingsCategorySection({
    sectionId: "regional",
    sectionName: "Regional Settings", 
    initialValues: {
      dateFormat: settings?.date_format || "DD/MM/YYYY",
      timeFormat: settings?.time_format || "12-hour"
    },
    onSave: async (values) => {
      const updates = {
        date_format: values.dateFormat,
        time_format: values.timeFormat
      };

      const result = await updateSettings(updates);
      if (!result.success) {
        throw new Error("Failed to save regional settings");
      }
    }
  });

  // Update form values when settings load
  useEffect(() => {
    if (settings) {
      brandingSection.setValues({
        companyName: settings.photography_business_name || "",
        brandColor: settings.primary_brand_color || "#1EB29F"
      });

      regionalSection.setValues({
        dateFormat: settings.date_format || "DD/MM/YYYY",
        timeFormat: settings.time_format || "12-hour"
      });
    }
  }, [settings]);

  // Tutorial steps
  const tutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: "Set Up Your Business Information",
      description: "Let's add your business name and branding. This information will appear on client communications and invoices.",
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-primary" />
            <span>Add your photography business name</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4 text-primary" />
            <span>Upload your logo and set brand colors</span>
          </div>
        </div>
      ),
      canProceed: true,
      mode: 'modal'
    },
    {
      id: 2,
      title: "Enter Your Business Name",
      description: "Please enter your photography business name below. This is required to continue and will be used in all client communications.",
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• Required for professional communications</p>
          <p>• Appears on invoices, contracts, and emails</p>
          <p>• Can be changed later if needed</p>
        </div>
      ),
      canProceed: !!brandingSection.values.companyName?.trim(),
      mode: 'floating'
    }
  ];

  const handleTutorialComplete = async () => {
    // Tutorial complete, return to profile tutorial or getting started
    setShowTutorial(false);
    navigate('/settings/profile?tutorial=true&step=4');
  };

  const handleTutorialExit = async () => {
    // Exit tutorial, mark step 1 as completed and return to getting started
    await advanceStep(2);
    setShowTutorial(false);
    navigate('/getting-started');
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file before uploading
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    // Upload immediately like profile photo
    await uploadLogo(file);
    
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const validateBrandColor = (color: string) => {
    return /^#[0-9A-F]{6}$/i.test(color);
  };

  const handleBrandColorChange = (value: string) => {
    // Allow any input while typing, validate only for final color picker sync
    brandingSection.updateValue("brandColor", value);
  };

  const handleDeleteLogo = async () => {
    try {
      // Clear the logo URL in settings
      await updateSettings({ logo_url: null });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Failed to delete logo:", error);
    }
  };

  if (loading) {
    return (
      <SettingsPageWrapper>
        <SettingsHeader
          title="General"
          description="Manage your general application preferences"
        />
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <SettingsHeader
        title="General"
        description="Manage your general application preferences"
      />
      
      <div className="space-y-8">
        <CategorySettingsSection
          title="Branding"
          description="Customize your brand appearance across client-facing materials"
          sectionId="branding"
          data-walkthrough="business-form"
        >
          <div className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company-name">Photography Business Name</Label>
              <Input
                id="company-name"
                value={brandingSection.values.companyName}
                onChange={(e) => brandingSection.updateValue("companyName", e.target.value)}
                placeholder="Enter your photography business name"
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                This will appear on invoices, contracts, and client communications
              </p>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label htmlFor="logo-upload">Logo Upload</Label>
              
              {/* Current Logo Preview - Always show container to prevent layout shift */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg bg-muted/30 max-w-md min-h-[80px]">
                {settings?.logo_url ? (
                  <>
                    {/* Mobile Layout */}
                    <div className="flex items-center gap-3 sm:hidden">
                      <div className="relative cursor-pointer" onClick={() => setIsLogoModalOpen(true)}>
                        <img 
                          src={settings.logo_url} 
                          alt="Current logo - click to enlarge" 
                          className="w-12 h-12 object-contain bg-white border rounded hover:opacity-80 transition-opacity"
                          title="Click to view full size"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Current Logo</p>
                        <p className="text-xs text-muted-foreground">Logo is currently set</p>
                      </div>
                    </div>
                    
                    {/* Desktop/Tablet Layout */}
                    <div className="hidden sm:flex sm:items-center sm:gap-4 sm:flex-1">
                      <div className="relative cursor-pointer" onClick={() => setIsLogoModalOpen(true)}>
                        <img 
                          src={settings.logo_url} 
                          alt="Current logo - click to enlarge" 
                          className="w-16 h-16 object-contain bg-white border rounded hover:opacity-80 transition-opacity"
                          title="Click to view full size"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Current Logo</p>
                        <p className="text-xs text-muted-foreground">Logo is currently set</p>
                      </div>
                    </div>

                    {/* Delete Button - Full width on mobile, inline on larger screens */}
                    <div className="w-full sm:w-auto">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto flex items-center justify-center gap-2 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Logo</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete your logo? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteLogo}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Logo
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No logo set</p>
                  </div>
                )}
              </div>

              {/* File Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFileButtonClick}
                    disabled={uploading}
                    className="flex items-center gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading..." : "Choose New Logo"}
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              
              <p className="text-sm text-muted-foreground">
                Supported formats: PNG, JPG, SVG
              </p>
            </div>

            {/* Brand Color */}
            <div className="space-y-2">
              <Label htmlFor="brand-color">Primary Brand Color</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="brand-color"
                  type="color"
                  value={brandingSection.values.brandColor}
                  onChange={(e) => brandingSection.updateValue("brandColor", e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={brandingSection.values.brandColor}
                  onChange={(e) => handleBrandColorChange(e.target.value)}
                  className="flex-1 max-w-xs"
                  placeholder="#1EB29F"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Used in client-facing UI and outgoing messages. Must be a valid hex color (e.g., #1EB29F)
              </p>
            </div>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title="Regional Settings"
          description="Configure date and time display preferences"
          sectionId="regional"
        >
          <div className="space-y-6">
            {/* Date Format */}
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select 
                value={regionalSection.values.dateFormat} 
                onValueChange={(value) => regionalSection.updateValue("dateFormat", value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Format */}
            <div className="space-y-3">
              <Label>Time Format</Label>
              <RadioGroup 
                value={regionalSection.values.timeFormat} 
                onValueChange={(value) => regionalSection.updateValue("timeFormat", value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="12-hour" id="12-hour" />
                  <Label htmlFor="12-hour">12-hour (e.g. 2:00 PM)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="24-hour" id="24-hour" />
                  <Label htmlFor="24-hour">24-hour (e.g. 14:00)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
        </CategorySettingsSection>
      </div>

      {/* Logo Preview Modal */}
      <Dialog open={isLogoModalOpen} onOpenChange={setIsLogoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Logo Preview</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-6">
            {settings?.logo_url && (
              <img 
                src={settings.logo_url} 
                alt="Logo full size preview" 
                className="max-w-full max-h-96 object-contain bg-white border rounded shadow-sm"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tutorial */}
      <OnboardingTutorial
        steps={tutorialSteps}
        onComplete={handleTutorialComplete}
        onExit={handleTutorialExit}
        isVisible={showTutorial}
      />
    </SettingsPageWrapper>
  );
}