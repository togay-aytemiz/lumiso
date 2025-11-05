import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams, useNavigate } from "react-router-dom";
import SettingsPageWrapper from "@/components/settings/SettingsPageWrapper";
import { CategorySettingsSection } from "@/components/settings/CategorySettingsSection";
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

export default function Profile() {
  const [emailAddress, setEmailAddress] = useState("");
  const [isProfilePhotoModalOpen, setIsProfilePhotoModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { profile, loading: profileLoading, uploading, updateProfile, uploadProfilePhoto, deleteProfilePhoto } = useProfile();
  const { workingHours, loading: workingHoursLoading, updateWorkingHour } = useWorkingHours();
  const { activeOrganization } = useOrganization();
  const { completeCurrentStep } = useOnboarding();
  const { toast } = useToast();
  const { t } = useTranslation(['pages', 'common']);

  // Check if we're in tutorial mode
  const isInTutorial = searchParams.get('tutorial') === 'true';
  const stepParam = searchParams.get('step');
  const [showTutorial, setShowTutorial] = useState(isInTutorial);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(() => {
    if (stepParam) return parseInt(stepParam) - 1;
    return 0;
  });

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
  }, [profile, profileLoading]);

  // Update working hours form when data loads
  useEffect(() => {
    if (workingHours.length > 0) {
      workingHoursSection.setValues({
        workingHours: workingHours
      });
    }
  }, [workingHours]);

  const handleWorkingHourUpdate = async (dayOfWeek: number, field: string, value: any) => {
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadProfilePhoto(file);
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
      <div className="space-y-8">
        <CategorySettingsSection
          title={t('settings.profile.profileInfo.title')}
          description={t('settings.profile.profileInfo.description')}
          sectionId="profile"
          data-walkthrough="profile-form"
        >
          <div className="space-y-6">
            {/* Avatar Upload */}
            <div className="space-y-2">
              <Label htmlFor="avatar-upload">{t('settings.profile.profileInfo.profilePhoto')}</Label>
              
              {/* Current Photo Preview - Always show container to prevent layout shift */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg bg-muted/30 max-w-md min-h-[80px]">
                {profile?.profile_photo_url ? (
                  <>
                    {/* Mobile Layout */}
                    <div className="flex items-center gap-3 sm:hidden">
                      <div className="relative cursor-pointer" onClick={() => setIsProfilePhotoModalOpen(true)}>
                        <img 
                          src={profile.profile_photo_url} 
                          alt="Current profile photo - click to enlarge" 
                          className="w-12 h-12 object-cover bg-white border rounded-full hover:opacity-80 transition-opacity"
                          title="Click to view full size"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t('settings.profile.profileInfo.currentPhoto')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.profile.profileInfo.photoCurrentlySet')}</p>
                      </div>
                    </div>
                    
                    {/* Desktop/Tablet Layout */}
                    <div className="hidden sm:flex sm:items-center sm:gap-4 sm:flex-1">
                      <div className="relative cursor-pointer" onClick={() => setIsProfilePhotoModalOpen(true)}>
                        <img 
                          src={profile.profile_photo_url} 
                          alt="Current profile photo - click to enlarge" 
                          className="w-16 h-16 object-cover bg-white border rounded-full hover:opacity-80 transition-opacity"
                          title="Click to view full size"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t('settings.profile.profileInfo.currentPhoto')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.profile.profileInfo.photoCurrentlySet')}</p>
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
                    </div>
                  </>
                ) : (
                  <>
                    {/* Mobile Layout - Placeholder */}
                    <div className="flex items-center gap-3 sm:hidden">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {profileSection.values.fullName 
                            ? profileSection.values.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            : 'U'
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t('settings.profile.profileInfo.defaultAvatar')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.profile.profileInfo.defaultAvatarHelp')}</p>
                      </div>
                    </div>
                    
                    {/* Desktop/Tablet Layout - Placeholder */}
                    <div className="hidden sm:flex sm:items-center sm:gap-4 sm:flex-1">
                      <Avatar className="w-16 h-16">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                          {profileSection.values.fullName 
                            ? profileSection.values.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                            : 'U'
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t('settings.profile.profileInfo.defaultAvatar')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.profile.profileInfo.defaultAvatarLongHelp')}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* File Upload Button */}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  className="flex items-center gap-2 w-full sm:w-fit"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? t('settings.profile.profileInfo.uploading') : profile?.profile_photo_url ? t('settings.profile.profileInfo.chooseNewFile') : t('settings.profile.profileInfo.chooseFile')}
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                {t('settings.profile.profileInfo.fileFormatsHelp')}
              </p>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full-name">{t('settings.profile.profileInfo.fullName')}</Label>
              <Input
                id="full-name"
                placeholder={t('settings.profile.profileInfo.fullNamePlaceholder')}
                value={profileSection.values.fullName}
                onChange={(e) => profileSection.updateValue("fullName", e.target.value)}
                onBlur={createTrimmedBlurHandler(profileSection.values.fullName, (value) => profileSection.updateValue("fullName", value))}
                className="max-w-md"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t('settings.profile.profileInfo.phoneNumber')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('settings.profile.profileInfo.phoneNumberPlaceholder')}
                value={profileSection.values.phoneNumber}
                onChange={(e) => profileSection.updateValue("phoneNumber", e.target.value)}
                onBlur={createTrimmedBlurHandler(profileSection.values.phoneNumber, (value) => profileSection.updateValue("phoneNumber", value))}
                className="max-w-md"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('settings.profile.profileInfo.emailAddress')}</Label>
              <Input
                id="email"
                type="email"
                value={emailAddress}
                disabled
                className="max-w-md"
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.profile.profileInfo.emailHelp')}
              </p>
            </div>
          </div>
        </CategorySettingsSection>

        <CategorySettingsSection
          title={t('settings.profile.workingHours.title')}
          description={t('settings.profile.workingHours.helpText')}
          sectionId="working-hours"
        >
          <div className="space-y-4">
            {days.map((dayOfWeek, index) => {
              const workingHour = getWorkingHourByDay(dayOfWeek);
              return (
                <div key={dayOfWeek} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border rounded-lg">
                  {/* Mobile/Tablet - keep original order */}
                  <div className="flex items-center justify-between sm:hidden gap-3">
                    <Label className="font-medium text-sm">
                      {dayLabels[index]}
                    </Label>
                    <Switch
                      checked={workingHour.enabled}
                      onCheckedChange={(checked) => handleWorkingHourUpdate(dayOfWeek, 'enabled', checked)}
                    />
                  </div>
                  
                  {/* Desktop - LTR layout: Switch first, then day name */}
                  <div className="hidden sm:flex sm:items-center sm:w-32 gap-3">
                    <Switch
                      checked={workingHour.enabled}
                      onCheckedChange={(checked) => handleWorkingHourUpdate(dayOfWeek, 'enabled', checked)}
                    />
                    <Label className="font-medium text-sm">
                      {dayLabels[index]}
                    </Label>
                  </div>
                  
                  {workingHour.enabled && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground min-w-20">{t('labels.from', { ns: 'common' })}</Label>
                        <Select
                          value={workingHour.start_time} 
                          onValueChange={(value) => handleWorkingHourUpdate(dayOfWeek, 'start_time', value)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground min-w-20">{t('labels.to', { ns: 'common' })}</Label>
                        <Select
                          value={workingHour.end_time} 
                          onValueChange={(value) => handleWorkingHourUpdate(dayOfWeek, 'end_time', value)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
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
          </div>
        </CategorySettingsSection>
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
