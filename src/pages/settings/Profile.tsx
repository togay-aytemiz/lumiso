import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams, useNavigate } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import {
  SettingsCollectionSection,
  SettingsFormSection,
} from "@/components/settings/SettingsSectionVariants";
import { SettingsRefreshButton } from "@/components/settings/SettingsRefreshButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, Loader2, X, User, Settings, CheckCircle } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { SettingsLoadingSkeleton } from "@/components/ui/loading-presets";
import { useWorkingHours } from "@/hooks/useWorkingHours";
import { useToast } from "@/hooks/use-toast";
import { useSettingsCategorySection } from "@/hooks/useSettingsCategorySection";
import { useOrganization } from "@/contexts/OrganizationContext";
import { trimAndNormalizeSpaces, createTrimmedBlurHandler } from "@/lib/inputUtils";
import { OnboardingTutorial, TutorialStep } from "@/components/shared/OnboardingTutorial";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useTranslation } from "react-i18next";
import { useSettingsFileUploader } from "@/hooks/useSettingsFileUploader";

export default function Profile() {
  const [emailAddress, setEmailAddress] = useState("");
  const [isProfilePhotoModalOpen, setIsProfilePhotoModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const {
    profile,
    loading: profileLoading,
    uploading,
    updateProfile,
    uploadProfilePhoto,
    deleteProfilePhoto,
    refreshProfile,
  } = useProfile();
  const {
    workingHours,
    loading: workingHoursLoading,
    updateWorkingHour,
    refetch: refetchWorkingHours,
  } = useWorkingHours();
  const { activeOrganization } = useOrganization();
  const { completeCurrentStep } = useOnboarding();
  const { toast } = useToast();
  const { t } = useTranslation(['pages', 'common']);
  const {
    inputProps: profilePhotoInputProps,
    openFilePicker: openProfilePhotoPicker,
    isUploading: uploaderBusy,
  } = useSettingsFileUploader({
    inputRef: fileInputRef,
    upload: uploadProfilePhoto,
    accept: ["image/png", "image/jpeg", "image/webp"],
    maxSizeMB: 2,
    onError: (error) =>
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      }),
  });

  // Check if we're in tutorial mode
  const isInTutorial = searchParams.get('tutorial') === 'true';
  const stepParam = searchParams.get('step');
  const [showTutorial, setShowTutorial] = useState(isInTutorial);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(() => {
    if (stepParam) return parseInt(stepParam) - 1;
    return 0;
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isProfileRefreshing, setIsProfileRefreshing] = useState(false);

  // Profile section state
  const profileSection = useSettingsCategorySection({
    sectionId: "profile",
    sectionName: t('settings.profile.title'),
    initialValues: {
      fullName: profile?.full_name || "",
      phoneNumber: profile?.phone_number || "",
    },
    onSave: async (values) => {
      const result = await updateProfile({
        full_name: trimAndNormalizeSpaces(values.fullName),
        phone_number: trimAndNormalizeSpaces(values.phoneNumber),
      });
      
      if (!result.success) {
        throw new Error("Failed to save profile");
      }
    }
  });

  // Working hours section state
  const workingHoursSection = useSettingsCategorySection({
    sectionId: "working-hours",
    sectionName: t('settings.profile.workingHours.title'),
    initialValues: {
      workingHours: workingHours
    },
    onSave: async (values) => {
      // Working hours are saved immediately on change, so nothing to do here
      return values;
    }
  });

  const days = [1, 2, 3, 4, 5, 6, 0]; // Monday=1, Sunday=0
  const dayLabels = [
    t('settings.profile.workingHours.monday'),
    t('settings.profile.workingHours.tuesday'),
    t('settings.profile.workingHours.wednesday'),
    t('settings.profile.workingHours.thursday'),
    t('settings.profile.workingHours.friday'),
    t('settings.profile.workingHours.saturday'),
    t('settings.profile.workingHours.sunday')
  ];

  // Get current user info
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) setEmailAddress(user.email);
    return user;
  };

  // Load profile data when component mounts
  useEffect(() => {
    getCurrentUser();
  }, []);

  // Update form fields when profile loads
  useEffect(() => {
    if (profile && !profileLoading) {
      profileSection.setValues({
        fullName: profile.full_name || "",
        phoneNumber: profile.phone_number || "",
      });
    }
  }, [profile, profileLoading, profileSection]);

  // Update working hours form when data loads
  useEffect(() => {
    if (workingHours.length > 0) {
      workingHoursSection.setValues({
        workingHours: workingHours
      });
    }
  }, [workingHours, workingHoursSection]);

  useEffect(() => {
    if (!profileLoading && !workingHoursLoading && !lastSyncedAt) {
      setLastSyncedAt(new Date());
    }
  }, [lastSyncedAt, profileLoading, workingHoursLoading]);

  const handleWorkingHourUpdate = async (
    dayOfWeek: number,
    field: string,
    value: string | boolean | null
  ) => {
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);
    if (workingHour) {
      const result = await updateWorkingHour(dayOfWeek, { [field]: value });
      if (result.success) {
        toast({
          title: t('settings.profile.toasts.success'),
          description: t('settings.profile.toasts.workingHoursUpdated'),
        });
      }
      // Mark working hours section as dirty to show save button
      workingHoursSection.updateValue("workingHours", workingHours);
    }
  };

  const handleDeleteProfilePhoto = async () => {
    const result = await deleteProfilePhoto();
    if (result.success) {
      // The toast is handled in the hook
    }
  };

  const getWorkingHourByDay = (dayOfWeek: number) => {
    const workingHour = workingHours.find(wh => wh.day_of_week === dayOfWeek);
    if (workingHour) {
      return {
        ...workingHour,
        // Convert "09:00:00" to "09:00"
        start_time: workingHour.start_time ? workingHour.start_time.substring(0, 5) : "09:00",
        end_time: workingHour.end_time ? workingHour.end_time.substring(0, 5) : "17:00"
      };
    }
    return {
      enabled: false,
      start_time: "09:00",
      end_time: "17:00"
    };
  };

  // Generate time options from 06:00 to 22:00
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 6; hour <= 22; hour++) {
      const timeString = `${hour.toString().padStart(2, '0')}:00`;
      times.push(timeString);
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  const handleProfileRefresh = async () => {
    try {
      setIsProfileRefreshing(true);
      await Promise.all([refreshProfile(), refetchWorkingHours()]);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error("Failed to refresh profile data", error);
    } finally {
      setIsProfileRefreshing(false);
    }
  };

  // Tutorial steps
  const tutorialSteps: TutorialStep[] = [
    {
      id: 1,
      title: t('settings.profile.tutorial.welcome.title'),
      description: t('settings.profile.tutorial.welcome.description'),
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-primary" />
            <span>{t('settings.profile.tutorial.welcome.updateInfo')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Settings className="h-4 w-4 text-primary" />
            <span>{t('settings.profile.tutorial.welcome.configureHours')}</span>
          </div>
        </div>
      ),
      canProceed: true,
      mode: 'modal'
    },
    {
      id: 2,
      title: t('settings.profile.tutorial.completeInfo.title'),
      description: t('settings.profile.tutorial.completeInfo.description'),
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{t('settings.profile.tutorial.completeInfo.fullNameRequired')}</p>
          <p>{t('settings.profile.tutorial.completeInfo.phoneOptional')}</p>
          <p>{t('settings.profile.tutorial.completeInfo.profilePhoto')}</p>
        </div>
      ),
      canProceed: !!profileSection.values.fullName?.trim(),
      mode: 'floating'
    },
    {
      id: 3,
      title: t('settings.profile.tutorial.businessInfo.title'),
      description: t('settings.profile.tutorial.businessInfo.description'),
      content: (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{t('settings.profile.tutorial.businessInfo.businessNameRequired')}</p>
          <p>{t('settings.profile.tutorial.businessInfo.usedIn')}</p>
          <p>{t('settings.profile.tutorial.businessInfo.canChange')}</p>
        </div>
      ),
      route: "/settings/general",
      canProceed: !!activeOrganization?.name?.trim(),
      mode: 'floating'
    },
    {
      id: 4,
      title: t('settings.profile.tutorial.setupComplete.title'),
      description: t('settings.profile.tutorial.setupComplete.description'),
      content: (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">{t('settings.profile.tutorial.setupComplete.success')}</span>
        </div>
      ),
      canProceed: true,
      mode: 'modal'
    }
  ];

  const handleTutorialComplete = async () => {
    // Profile tutorial completed, moving to general settings
    // Navigate to General tutorial instead of completing step
    setShowTutorial(false);
    navigate('/settings/general?tutorial=true');
  };

  const handleTutorialExit = async () => {
    setShowTutorial(false);
  };

  const uploadBusy = uploading || uploaderBusy;

  // Show loading state until all data is loaded
  if (profileLoading || workingHoursLoading) {
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
          sectionId="profile"
          title={t('settings.profile.profileInfo.title')}
          description={t('settings.profile.profileInfo.description')}
          dataWalkthrough="profile-form"
          fieldColumns={2}
          leftColumnFooter={
            <SettingsRefreshButton
              onRefresh={handleProfileRefresh}
              isRefreshing={isProfileRefreshing}
              lastUpdatedAt={lastSyncedAt}
            />
          }
        >
          <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-4">
                {profile?.profile_photo_url ? (
                  <button
                    type="button"
                    onClick={() => setIsProfilePhotoModalOpen(true)}
                    className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <img
                      src={profile.profile_photo_url}
                      alt={t('settings.profile.profileInfo.currentPhoto')}
                      className="h-16 w-16 rounded-full border bg-white object-cover"
                    />
                  </button>
                ) : (
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                      {profileSection.values.fullName
                        ? profileSection.values.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()
                        : 'U'}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <p className="text-sm font-medium">
                    {profile?.profile_photo_url
                      ? t('settings.profile.profileInfo.currentPhoto')
                      : t('settings.profile.profileInfo.defaultAvatar')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.profile_photo_url
                      ? t('settings.profile.profileInfo.photoCurrentlySet')
                      : t('settings.profile.profileInfo.defaultAvatarLongHelp')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={openProfilePhotoPicker}
                  disabled={uploadBusy}
                >
                  {uploadBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploadBusy
                    ? t('settings.profile.profileInfo.uploading')
                    : profile?.profile_photo_url
                      ? t('settings.profile.profileInfo.chooseNewFile')
                      : t('settings.profile.profileInfo.chooseFile')}
                </Button>
                {profile?.profile_photo_url && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex items-center gap-2 text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                        {t('common.delete')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('settings.profile.profileInfo.deletePhoto')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('settings.profile.profileInfo.deletePhotoConfirm')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteProfilePhoto}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t('settings.profile.profileInfo.deletePhotoButton')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  {...profilePhotoInputProps}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.profile.profileInfo.fileFormatsHelp')}
              </p>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="full-name">{t('settings.profile.profileInfo.fullName')}</Label>
            <Input
              id="full-name"
              placeholder={t('settings.profile.profileInfo.fullNamePlaceholder')}
              value={profileSection.values.fullName}
              onChange={(e) => profileSection.updateValue("fullName", e.target.value)}
              onBlur={createTrimmedBlurHandler(
                profileSection.values.fullName,
                (value) => profileSection.updateValue("fullName", value)
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('settings.profile.profileInfo.phoneNumber')}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t('settings.profile.profileInfo.phoneNumberPlaceholder')}
              value={profileSection.values.phoneNumber}
              onChange={(e) => profileSection.updateValue("phoneNumber", e.target.value)}
              onBlur={createTrimmedBlurHandler(
                profileSection.values.phoneNumber,
                (value) => profileSection.updateValue("phoneNumber", value)
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('settings.profile.profileInfo.emailAddress')}</Label>
            <Input id="email" type="email" value={emailAddress} disabled />
            <p className="text-xs text-muted-foreground">
              {t('settings.profile.profileInfo.emailHelp')}
            </p>
          </div>
        </SettingsFormSection>

        <SettingsCollectionSection
          sectionId="working-hours"
          title={t('settings.profile.workingHours.title')}
          description={t('settings.profile.workingHours.helpText')}
          bodyClassName="divide-y divide-border/70"
        >
          {days.map((dayOfWeek, index) => {
            const workingHour = getWorkingHourByDay(dayOfWeek);
            const dayLabel = dayLabels[index];
            return (
              <div
                key={dayOfWeek}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="flex w-full items-center justify-between gap-4 sm:w-80">
                  <div>
                    <p className="text-sm font-semibold">{dayLabel}</p>
                  </div>
                  <Switch
                    checked={workingHour.enabled}
                    onCheckedChange={(checked) =>
                      handleWorkingHourUpdate(dayOfWeek, 'enabled', checked)
                    }
                    aria-label={dayLabel}
                  />
                </div>
                {workingHour.enabled && (
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {t('labels.from', { ns: 'common' })}
                      </span>
                      <Select
                        value={workingHour.start_time}
                        onValueChange={(value) =>
                          handleWorkingHourUpdate(dayOfWeek, 'start_time', value)
                        }
                      >
                        <SelectTrigger
                          className="w-28"
                          aria-label={`${dayLabel} start time`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={`${dayOfWeek}-start-${time}`} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {t('labels.to', { ns: 'common' })}
                      </span>
                      <Select
                        value={workingHour.end_time}
                        onValueChange={(value) =>
                          handleWorkingHourUpdate(dayOfWeek, 'end_time', value)
                        }
                      >
                        <SelectTrigger
                          className="w-28"
                          aria-label={`${dayLabel} end time`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeOptions.map((time) => (
                            <SelectItem key={`${dayOfWeek}-end-${time}`} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </SettingsCollectionSection>
      </div>

      {/* Profile Photo Modal */}
      <Dialog open={isProfilePhotoModalOpen} onOpenChange={setIsProfilePhotoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.profile.profileInfo.profilePhoto')}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {profile?.profile_photo_url && (
              <img 
                src={profile.profile_photo_url} 
                alt="Profile photo" 
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Onboarding Tutorial - stays visible even when navigating to other pages */}
      {showTutorial && (
        <OnboardingTutorial
          steps={tutorialSteps}
          onComplete={handleTutorialComplete}
          onExit={handleTutorialExit}
          isVisible={showTutorial}
          initialStepIndex={tutorialStepIndex}
        />
      )}
    </SettingsPageWrapper>
  );
}
