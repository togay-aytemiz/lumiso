import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Loader2, X, Building, Settings, CheckCircle } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { SocialChannelsSection } from "@/components/settings/SocialChannelsSection";
import { useOrganization } from "@/contexts/OrganizationContext";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import { detectBrowserTimezone } from "@/lib/dateFormatUtils";
import { emailSchema, phoneSchema } from "@/lib/validation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useSettingsFileUploader } from "@/hooks/useSettingsFileUploader";
import { useToast } from "@/hooks/use-toast";

export default function General() {
  const {
    settings,
    loading,
    uploading,
    updateSettings,
    uploadLogo,
    deleteLogo,
  } = useOrganizationSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeCurrentStep } = useOnboarding();
  const { t } = useTranslation(['pages', 'common']);
  const { toast } = useToast();
  const {
    inputProps: logoUploaderInputProps,
    openFilePicker: openLogoFilePicker,
    isUploading: logoUploaderBusy,
  } = useSettingsFileUploader({
    inputRef: fileInputRef,
    upload: uploadLogo,
    accept: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    maxSizeMB: 2,
    onError: (error) =>
      toast({
        title: "Logo upload failed",
        description: error.message,
        variant: "destructive",
      }),
  });

  // Check if we're in tutorial mode from Profile onboarding
  const isInTutorial = searchParams.get('tutorial') === 'true';
  const [showTutorial, setShowTutorial] = useState(isInTutorial);
  
  // Create tutorial steps for General page (steps 3, 4, and 5 from Profile)
  const tutorialSteps: TutorialStep[] = [
    {
      id: 3,
      title: t("settings.general.tutorial.businessInfo.title"),
      description: t("settings.general.tutorial.businessInfo.description"),
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Building className="h-4 w-4 text-primary" />
            <span>{t("settings.general.tutorial.businessInfo.setBusinessName")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4 text-primary" />
            <span>{t("settings.general.tutorial.businessInfo.uploadLogo")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4 text-primary" />
            <span>{t("settings.general.tutorial.businessInfo.chooseBrandColors")}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {t("settings.general.tutorial.businessInfo.help")}
          </div>
        </div>
      ),
      canProceed: true,
      mode: 'modal'
    },
    {
      id: 4,
      title: t("settings.general.tutorial.addBusinessName.title"),
      description: t("settings.general.tutorial.addBusinessName.description"),
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• {t("settings.general.tutorial.addBusinessName.required")}</p>
          <p>• {t("settings.general.tutorial.addBusinessName.appearsOn")}</p>
          <p>• {t("settings.general.tutorial.addBusinessName.canChange")}</p>
        </div>
      ),
      canProceed: !!settings?.photography_business_name?.trim(),
      mode: 'floating'
    },
    {
      id: 5,
      title: (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span>{t("settings.general.tutorial.setupComplete.title")}</span>
        </div>
      ),
      description: t("settings.general.tutorial.setupComplete.description"),
      content: null,
      canProceed: true,
      mode: 'modal'
    }
  ];

  // Branding section state
  const brandingSection = useSettingsCategorySection({
    sectionId: "branding",
    sectionName: t("settings.general.branding.title"),
    initialValues: {
      companyName: settings?.photography_business_name || "",
      businessEmail: settings?.email || "",
      businessPhone: settings?.phone || "",
      brandColor: settings?.primary_brand_color || "#1EB29F"
    },
    onSave: async (values) => {
      // Save branding settings (logo uploads automatically on selection)
      const updates = {
        photography_business_name: values.companyName,
        email: values.businessEmail,
        phone: values.businessPhone,
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
    sectionName: t("settings.general.regional.title"),
    initialValues: {
      dateFormat: settings?.date_format || "DD/MM/YYYY",
      timeFormat: settings?.time_format || "12-hour",
      timezone: settings?.timezone || detectBrowserTimezone()
    },
    onSave: async (values) => {
      const updates = {
        date_format: values.dateFormat,
        time_format: values.timeFormat,
        timezone: values.timezone
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
        businessEmail: settings.email || "",
        businessPhone: settings.phone || "",
        brandColor: settings.primary_brand_color || "#1EB29F"
      });

      regionalSection.setValues({
        dateFormat: settings.date_format || "DD/MM/YYYY",
        timeFormat: settings.time_format || "12-hour",
        timezone: settings.timezone || detectBrowserTimezone()
      });
    }
  }, [brandingSection, regionalSection, settings]);

  // Remove the old hardcoded tutorial steps - using dynamic ones above
  const handleTutorialComplete = async () => {
    // Settings tutorial completed successfully
    try {
      await completeCurrentStep();
      // Navigating to next tutorial step
      setShowTutorial(false);
      navigate('/getting-started');
    } catch (error) {
      console.error('❌ Error completing step:', error);
    }
  };

  const handleTutorialExit = async () => {
    setShowTutorial(false);
  };

  const logoUploadBusy = uploading || logoUploaderBusy;

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
        <SettingsLoadingSkeleton rows={4} />
      </SettingsPageWrapper>
    );
  }

  return (
    <SettingsPageWrapper>
      <div className="space-y-8">
        <CategorySettingsSection
          title={t("settings.general.branding.title")}
          description={t("settings.general.branding.description")}
          sectionId="branding"
          data-walkthrough="business-form"
        >
          <div className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company-name">{t("settings.general.branding.company_name")}</Label>
              <Input
                id="company-name"
                value={brandingSection.values.companyName}
                onChange={(e) => brandingSection.updateValue("companyName", e.target.value)}
                placeholder={t("settings.general.branding.company_name_placeholder")}
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                {t("settings.general.branding.company_name_help")}
              </p>
            </div>

            {/* Business Email */}
            <div className="space-y-2">
              <Label htmlFor="business-email">{t("settings.general.branding.business_email")}</Label>
              <Input
                id="business-email"
                type="email"
                value={brandingSection.values.businessEmail}
                onChange={(e) => {
                  const value = e.target.value;
                  brandingSection.updateValue("businessEmail", value);
                  // Validate email format
                  if (value && !emailSchema.safeParse(value).success) {
                    e.target.setCustomValidity("Please enter a valid email address");
                  } else {
                    e.target.setCustomValidity("");
                  }
                }}
                placeholder={t("settings.general.branding.business_email_placeholder")}
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                {t("settings.general.branding.business_email_help")}
              </p>
            </div>

            {/* Business Phone */}
            <div className="space-y-2">
              <Label htmlFor="business-phone">{t("settings.general.branding.business_phone")}</Label>
              <Input
                id="business-phone"
                type="tel"
                value={brandingSection.values.businessPhone}
                onChange={(e) => {
                  const value = e.target.value;
                  brandingSection.updateValue("businessPhone", value);
                  // Validate phone format (optional)
                  if (value && !phoneSchema.safeParse(value).success) {
                    e.target.setCustomValidity("Please enter a valid phone number");
                  } else {
                    e.target.setCustomValidity("");
                  }
                }}
                placeholder={t("settings.general.branding.business_phone_placeholder")}
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                {t("settings.general.branding.business_phone_help")}
              </p>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label htmlFor="logo-upload">{t("settings.general.branding.logo_upload")}</Label>
              
              {/* Current Logo Preview - Always show container to prevent layout shift */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg bg-muted/30 max-w-md min-h-[80px]">
                {settings?.logo_url ? (
                  <>
                    {/* Mobile Layout */}
                    <div className="flex items-center gap-3 sm:hidden">
                      <div className="relative cursor-pointer" onClick={() => setIsLogoModalOpen(true)}>
                        <img 
                          src={settings.logo_url} 
                          alt={t("settings.general.branding.logo_preview_alt")}
                          className="w-12 h-12 object-contain bg-white border rounded hover:opacity-80 transition-opacity"
                          title={t("settings.general.branding.logo_preview_tooltip")}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t("settings.general.branding.current_logo")}</p>
                        <p className="text-xs text-muted-foreground">{t("settings.general.branding.logo_set")}</p>
                      </div>
                    </div>
                    
                    {/* Desktop/Tablet Layout */}
                    <div className="hidden sm:flex sm:items-center sm:gap-4 sm:flex-1">
                      <div className="relative cursor-pointer" onClick={() => setIsLogoModalOpen(true)}>
                        <img 
                          src={settings.logo_url} 
                          alt={t("settings.general.branding.logo_preview_alt")}
                          className="w-16 h-16 object-contain bg-white border rounded hover:opacity-80 transition-opacity"
                          title={t("settings.general.branding.logo_preview_tooltip")}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t("settings.general.branding.current_logo")}</p>
                        <p className="text-xs text-muted-foreground">{t("settings.general.branding.logo_set")}</p>
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
                            {t('buttons.delete', { ns: 'common' })}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('settings.general.branding.deleteLogo')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t('settings.general.branding.deleteLogoConfirm')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('buttons.cancel', { ns: 'common' })}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteLogo}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {t('settings.general.branding.deleteLogoButton')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">{t('settings.general.branding.noLogoSet')}</p>
                  </div>
                )}
              </div>

              {/* File Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openLogoFilePicker}
                    disabled={logoUploadBusy}
                    className="flex items-center gap-2"
                  >
                    {logoUploadBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {logoUploadBusy
                      ? t("settings.general.branding.uploading")
                      : t("settings.general.branding.choose_new_logo")}
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  {...logoUploaderInputProps}
                />
              </div>
              
              <p className="text-sm text-muted-foreground">
                {t("settings.general.branding.logo_formats")}
              </p>
            </div>

            {/* Brand Color */}
            <div className="space-y-2">
              <Label htmlFor="brand-color">{t("settings.general.branding.primaryBrandColor")}</Label>
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
                {t("settings.general.branding.brandColorHelp")}
              </p>
            </div>
          </div>
        </CategorySettingsSection>

        {/* Social Channels Section */}
        {settings && (
          <SocialChannelsSection
            socialChannels={settings.social_channels || {}}
            onUpdate={(channels) => updateSettings({ social_channels: channels })}
            isDirty={false}
          />
        )}

        <CategorySettingsSection
          title={t("settings.general.regional.title")}
          description={t("settings.general.regional.description")}
          sectionId="regional"
        >
          <div className="space-y-6">
            {/* Date Format */}
            <div className="space-y-2">
              <Label>{t("settings.general.regional.dateFormat")}</Label>
              <Select 
                value={regionalSection.values.dateFormat} 
                onValueChange={(value) => regionalSection.updateValue("dateFormat", value)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">{t("date_formats.DD/MM/YYYY", { ns: "forms" })}</SelectItem>
                  <SelectItem value="MM/DD/YYYY">{t("date_formats.MM/DD/YYYY", { ns: "forms" })}</SelectItem>
                  <SelectItem value="YYYY-MM-DD">{t("date_formats.YYYY-MM-DD", { ns: "forms" })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Format */}
            <div className="space-y-3">
              <Label>{t("settings.general.regional.timeFormat")}</Label>
              <RadioGroup 
                value={regionalSection.values.timeFormat} 
                onValueChange={(value) => regionalSection.updateValue("timeFormat", value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="12-hour" id="12-hour" />
                  <Label htmlFor="12-hour">{t("settings.general.regional.timeFormat12Hour")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="24-hour" id="24-hour" />
                  <Label htmlFor="24-hour">{t("settings.general.regional.timeFormat24Hour")}</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Timezone */}
            <TimezoneSelector
              value={regionalSection.values.timezone}
              onValueChange={(value) => regionalSection.updateValue("timezone", value)}
            />

            {/* Language Preference */}
            <div className="space-y-2">
              <Label>{t("settings.general.language.title")}</Label>
              <div className="max-w-xs">
                <LanguageSwitcher variant="button" className="w-full justify-start" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("settings.general.language.description")}
              </p>
            </div>
          </div>
        </CategorySettingsSection>
      </div>

      {/* Logo Preview Modal */}
      <Dialog open={isLogoModalOpen} onOpenChange={setIsLogoModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("settings.general.branding.logoUpload")}</DialogTitle>
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
        initialStepIndex={0}
      />
    </SettingsPageWrapper>
  );
}
