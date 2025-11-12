import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import {
  SettingsCollectionSection,
  SettingsFormSection,
} from "@/components/settings/SettingsSectionVariants";
import { SettingsImageUploadCard } from "@/components/settings/SettingsImageUploadCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building, Upload, Settings, CheckCircle } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const { completeCurrentStep, currentStepInfo, nextStepInfo, isInGuidedSetup } = useOnboarding();
  const { t } = useTranslation(['pages', 'common', 'forms']);
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
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const onboardingProfileStepActive =
    isInGuidedSetup && currentStepInfo?.route?.startsWith("/settings/profile");
  const onboardingStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (isInTutorial) {
      setTutorialDismissed(false);
      setShowTutorial(true);
    }
  }, [isInTutorial]);

  useEffect(() => {
    if (onboardingProfileStepActive) {
      const currentId = currentStepInfo?.id ?? null;
      if (onboardingStepRef.current !== currentId) {
        onboardingStepRef.current = currentId;
        setTutorialDismissed(false);
      }
      if (!tutorialDismissed) {
        setShowTutorial(true);
      }
    }
  }, [onboardingProfileStepActive, currentStepInfo?.id, tutorialDismissed]);
  
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
    autoSave: true,
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
  const browserTimezone = useMemo(() => detectBrowserTimezone(), []);
  const setBrandingValues = brandingSection.setValues;
  const setRegionalValues = regionalSection.setValues;

  const companyNameSetting = settings?.photography_business_name ?? "";
  const businessEmailSetting = settings?.email ?? "";
  const businessPhoneSetting = settings?.phone ?? "";
  const brandColorSetting = settings?.primary_brand_color ?? "#1EB29F";
  const dateFormatSetting = settings?.date_format ?? "DD/MM/YYYY";
  const timeFormatSetting = settings?.time_format ?? "12-hour";
  const timezoneSetting = settings?.timezone ?? browserTimezone;

  useEffect(() => {
    if (!settings) return;

    setBrandingValues({
      companyName: companyNameSetting,
      businessEmail: businessEmailSetting,
      businessPhone: businessPhoneSetting,
      brandColor: brandColorSetting,
    });

    setRegionalValues({
      dateFormat: dateFormatSetting,
      timeFormat: timeFormatSetting,
      timezone: timezoneSetting,
    });
  }, [
    settings,
    companyNameSetting,
    businessEmailSetting,
    businessPhoneSetting,
    brandColorSetting,
    dateFormatSetting,
    timeFormatSetting,
    timezoneSetting,
    setBrandingValues,
    setRegionalValues,
  ]);

  // Remove the old hardcoded tutorial steps - using dynamic ones above
  const handleTutorialComplete = async () => {
    // Settings tutorial completed successfully
    try {
      await completeOnboarding();
      setTutorialDismissed(true);
      setShowTutorial(false);
      navigate('/getting-started');
    } catch (error) {
      console.error('❌ Error completing step:', error);
    }
  };

  const handleTutorialExit = async () => {
    setTutorialDismissed(true);
    setShowTutorial(false);
  };

  const logoUploadBusy = uploading || logoUploaderBusy;
  const hasLogo = Boolean(settings?.logo_url);
  const logoCardTitle = hasLogo
    ? t('settings.general.branding.current_logo')
    : t('settings.general.branding.logo_upload');
  const logoCardDescription = hasLogo
    ? t('settings.general.branding.logo_set')
    : t('settings.general.branding.logo_formats');

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
      <div className="space-y-10">
        <SettingsFormSection
          sectionId="branding"
          title={t("settings.general.branding.title")}
          description={t("settings.general.branding.description")}
          dataWalkthrough="business-form"
          fieldColumns={2}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company-name">{t("settings.general.branding.company_name")}</Label>
            <Input
              id="company-name"
              value={brandingSection.values.companyName}
              onChange={(e) => brandingSection.updateValue("companyName", e.target.value)}
              placeholder={t("settings.general.branding.company_name_placeholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.general.branding.company_name_help")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-email">{t("settings.general.branding.business_email")}</Label>
            <Input
              id="business-email"
              type="email"
              value={brandingSection.values.businessEmail}
              onChange={(e) => {
                const value = e.target.value;
                brandingSection.updateValue("businessEmail", value);
                if (value && !emailSchema.safeParse(value).success) {
                  e.target.setCustomValidity("Please enter a valid email address");
                } else {
                  e.target.setCustomValidity("");
                }
              }}
              placeholder={t("settings.general.branding.business_email_placeholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.general.branding.business_email_help")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-phone">{t("settings.general.branding.business_phone")}</Label>
            <Input
              id="business-phone"
              type="tel"
              value={brandingSection.values.businessPhone}
              onChange={(e) => {
                const value = e.target.value;
                brandingSection.updateValue("businessPhone", value);
                if (value && !phoneSchema.safeParse(value).success) {
                  e.target.setCustomValidity("Please enter a valid phone number");
                } else {
                  e.target.setCustomValidity("");
                }
              }}
              placeholder={t("settings.general.branding.business_phone_placeholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.general.branding.business_phone_help")}
            </p>
          </div>
          <SettingsImageUploadCard
            className="sm:col-span-2"
            title={logoCardTitle}
            description={logoCardDescription}
            helperText={t("settings.general.branding.logo_formats")}
            imageUrl={settings?.logo_url ?? undefined}
            previewAlt={t("settings.general.branding.logo_preview_alt")}
            placeholder={
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {t('settings.general.branding.noLogoSet')}
              </div>
            }
            previewShape="rounded"
            previewSize="lg"
            onPreview={hasLogo ? () => setIsLogoModalOpen(true) : undefined}
            uploadLabel={t("settings.general.branding.choose_new_logo")}
            uploadingLabel={t("settings.general.branding.uploading")}
            uploadBusy={logoUploadBusy}
            onUploadClick={openLogoFilePicker}
            inputRef={fileInputRef}
            inputProps={logoUploaderInputProps}
            deleteAction={
              hasLogo
                ? {
                    label: t('buttons.delete', { ns: 'common' }),
                    confirmationTitle: t('settings.general.branding.deleteLogo'),
                    confirmationDescription: t('settings.general.branding.deleteLogoConfirm'),
                    confirmationButtonLabel: t('settings.general.branding.deleteLogoButton'),
                    cancelLabel: t('buttons.cancel', { ns: 'common' }),
                    onConfirm: handleDeleteLogo,
                  }
                : undefined
            }
          />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="brand-color-input">{t("settings.general.branding.brandColor")}</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative h-12 w-12">
                <input
                  id="brand-color-input"
                  type="color"
                  value={brandingSection.values.brandColor}
                  onChange={(e) => brandingSection.updateValue("brandColor", e.target.value)}
                  className="peer absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
                  aria-label={t("settings.general.branding.brandColor")}
                  title={t("settings.general.branding.brandColorHelp")}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none h-12 w-12 rounded-full border border-border/60 shadow-[inset_0_1px_3px_rgba(15,23,42,0.25)] transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-[hsl(var(--accent-500))]"
                  style={{ backgroundColor: brandingSection.values.brandColor }}
                />
              </div>
              <Input
                value={brandingSection.values.brandColor}
                onChange={(e) => handleBrandColorChange(e.target.value)}
                placeholder="#1EB29F"
                pattern="^#[0-9A-Fa-f]{6}$"
                className="font-mono uppercase sm:max-w-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.general.branding.brandColorHelp")}
            </p>
          </div>
        </SettingsFormSection>

        {settings && (
          <SettingsCollectionSection
            sectionId="social-channels"
            title={t('forms:social_channels.title')}
            description={t('forms:social_channels.description')}
            bodyClassName="p-6"
          >
            <SocialChannelsSection
              socialChannels={settings.social_channels || {}}
              onUpdate={(channels) => updateSettings({ social_channels: channels })}
              isDirty={false}
              variant="embedded"
            />
          </SettingsCollectionSection>
        )}

        <SettingsFormSection
          sectionId="regional"
          title={t("settings.general.regional.title")}
          description={t("settings.general.regional.description")}
          fieldColumns={2}
        >
          <div className="space-y-2">
            <Label>{t("settings.general.regional.dateFormat")}</Label>
            <Select
              value={regionalSection.values.dateFormat}
              onValueChange={(value) => regionalSection.updateValue("dateFormat", value)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">{t("date_formats.DD/MM/YYYY", { ns: "forms" })}</SelectItem>
                <SelectItem value="MM/DD/YYYY">{t("date_formats.MM/DD/YYYY", { ns: "forms" })}</SelectItem>
                <SelectItem value="YYYY-MM-DD">{t("date_formats.YYYY-MM-DD", { ns: "forms" })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <div className="sm:col-span-2">
            <TimezoneSelector
              value={regionalSection.values.timezone}
              onValueChange={(value) => regionalSection.updateValue("timezone", value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t("settings.general.language.title")}</Label>
            <div className="max-w-xs">
              <LanguageSwitcher variant="button" className="w-full justify-start" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settings.general.language.description")}
            </p>
          </div>
        </SettingsFormSection>
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
