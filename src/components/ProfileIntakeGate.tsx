import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Check,
  Building2,
  CircleOff,
  Heart,
  Users,
  Shapes,
  Flower2,
  Stethoscope,
  Baby,
  UserRound,
  Star,
  CalendarDays,
  PawPrint,
  Building,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { logAuthEvent } from "@/lib/authTelemetry";

const MAX_MULTI_SELECT = Infinity; // unlimited selections
const TOTAL_STEPS = 4;

const STEP_FOOTER_KEY_MAP: Record<number, string> = {
  1: "pages:profileIntake.footers.name",
  2: "pages:profileIntake.footers.business",
  3: "pages:profileIntake.footers.projects",
  4: "pages:profileIntake.footers.sample",
};

const isDevEnvironment = () => {
  if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
    return true;
  }
  try {
    const meta = (0, eval)("import.meta") as { env?: { DEV?: boolean } } | undefined;
    return Boolean(meta?.env?.DEV);
  } catch {
    return false;
  }
};

const PROJECT_TYPE_OPTIONS = [
  { id: "wedding", icon: Heart },
  { id: "family", icon: Users },
  { id: "children", icon: Shapes },
  { id: "maternity", icon: Flower2 },
  { id: "birth", icon: Stethoscope },
  { id: "newborn", icon: Baby },
  { id: "headshots", icon: UserRound },
  { id: "senior", icon: Star },
  { id: "commercial", icon: Building2 },
  { id: "event", icon: CalendarDays },
  { id: "pet", icon: PawPrint },
  { id: "realEstate", icon: Building },
] as const satisfies ReadonlyArray<{ id: string; icon: LucideIcon }>;

type ProjectTypeOption = (typeof PROJECT_TYPE_OPTIONS)[number];
type ProjectTypeId = ProjectTypeOption["id"];

type IntakeErrors = {
  displayName?: string;
  businessName?: string;
  projectTypes?: string;
  sampleData?: string;
};

const preventDialogDismiss = (event: Event) => {
  event.preventDefault();
};

export function ProfileIntakeGate() {
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const {
    settings,
    loading: settingsLoading,
    updateSettings,
    refreshSettings,
  } = useOrganizationSettings();
  const { user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation(["pages", "common"]);

  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [projectTypes, setProjectTypes] = useState<ProjectTypeId[]>([]);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [manualComplete, setManualComplete] = useState(false);
  const [hasLoggedStart, setHasLoggedStart] = useState(false);
  const [wantsSampleData, setWantsSampleData] = useState<boolean | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const defaultProjectType = projectTypes[0];

  const debugOverride = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!isDevEnvironment()) return false;
    const params = new URLSearchParams(location.search);
    return params.get("debugIntake") === "1";
  }, [location.search]);

  const needsDisplayName = !profile?.full_name?.trim();
  const needsBusinessName = !settings?.photography_business_name?.trim();
  const needsProjectTypes = (settings?.preferred_project_types?.length ?? 0) === 0;

  const intakeComplete =
    Boolean(settings?.profile_intake_completed_at) &&
    !needsDisplayName &&
    !needsBusinessName &&
    !needsProjectTypes;

  const shouldShow =
    !profileLoading &&
    !settingsLoading &&
    !manualComplete &&
    (debugOverride || !intakeComplete);

  const stepDefinitions = useMemo(
    () => [
      {
        id: 1,
        title: t("pages:profileIntake.steps.name.title"),
        description: t("pages:profileIntake.steps.name.description"),
      },
      {
        id: 2,
        title: t("pages:profileIntake.steps.business.title"),
        description: t("pages:profileIntake.steps.business.description"),
      },
      {
        id: 3,
        title: t("pages:profileIntake.steps.projects.title"),
        description: t("pages:profileIntake.steps.projects.description"),
      },
      {
        id: 4,
        title: t("pages:profileIntake.steps.sample.title"),
        description: t("pages:profileIntake.steps.sample.description"),
      },
    ],
    [t]
  );

  const sampleDataOptions = useMemo(
    () => [
      {
        value: true,
        icon: Sparkles,
        title: t("pages:profileIntake.sampleData.yes.title"),
        description: t("pages:profileIntake.sampleData.yes.description"),
        recommended: true,
      },
      {
        value: false,
        icon: CircleOff,
        title: t("pages:profileIntake.sampleData.no.title"),
        description: t("pages:profileIntake.sampleData.no.description"),
      },
    ],
    [t]
  );

  const currentFooterKey = useMemo(
    () => STEP_FOOTER_KEY_MAP[currentStep] ?? "pages:profileIntake.footer",
    [currentStep]
  );

  const currentStepMeta = stepDefinitions[currentStep - 1];
  const isLastStep = currentStep === TOTAL_STEPS;
  const stepAnimationClass =
    direction === "forward"
      ? "animate-in fade-in slide-in-from-right-4"
      : "animate-in fade-in slide-in-from-left-4";

  useEffect(() => {
    if (!profileLoading) {
      if (profile?.full_name) {
        setDisplayName(profile.full_name);
      } else if (
        user?.user_metadata &&
        typeof user.user_metadata.full_name === "string"
      ) {
        setDisplayName(user.user_metadata.full_name);
      }
    }
  }, [profile?.full_name, profileLoading, user?.user_metadata]);

  useEffect(() => {
    if (!settingsLoading) {
      setBusinessName(settings?.photography_business_name ?? "");
      if (!debugOverride) {
        const preferred =
          settings?.preferred_project_types?.filter(
            (type): type is ProjectTypeId =>
              PROJECT_TYPE_OPTIONS.some((option) => option.id === type)
          ) ?? [];
        setProjectTypes(preferred);
      }
      if (
        wantsSampleData === null &&
        typeof settings?.seed_sample_data_onboarding === "boolean"
      ) {
        setWantsSampleData(settings.seed_sample_data_onboarding);
      }
    }
  }, [
    settings?.photography_business_name,
    settings?.preferred_project_types,
    settings?.seed_sample_data_onboarding,
    settingsLoading,
    debugOverride,
    wantsSampleData,
  ]);

  useEffect(() => {
    if (shouldShow && !hasLoggedStart) {
      logAuthEvent("auth_first_profile_intake_start", {
        supabaseUserId: user?.id,
        hasDisplayName: !needsDisplayName,
        hasBusinessName: !needsBusinessName,
        hasProjectTypes: !needsProjectTypes,
        debugForce: debugOverride,
      });
      setHasLoggedStart(true);
    }

    if (!shouldShow && hasLoggedStart) {
      setHasLoggedStart(false);
    }
  }, [
    shouldShow,
    hasLoggedStart,
    user?.id,
    needsDisplayName,
    needsBusinessName,
    needsProjectTypes,
    debugOverride,
  ]);

  if (!shouldShow) {
    return null;
  }

  const setFieldError = (field: keyof IntakeErrors, message?: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const toggleProjectType = (value: ProjectTypeId) => {
    setProjectTypes((prev) => {
      if (prev.includes(value)) {
        const next = prev.filter((entry) => entry !== value);
        if (next.length > 0) {
          setFieldError("projectTypes", undefined);
        }
        return next;
      }
      if (prev.length >= MAX_MULTI_SELECT) {
        toast({
          title: t("common:toast.error", { defaultValue: "Error" }),
          description: t("pages:profileIntake.errors.limit", {
            count: MAX_MULTI_SELECT,
          }),
          variant: "destructive",
        });
        return prev;
      }
      setFieldError("projectTypes", undefined);
      return [...prev, value];
    });
  };

  const validateStep = (stepToValidate: number) => {
    if (stepToValidate === 1) {
      if (!displayName.trim()) {
        setFieldError("displayName", t("pages:profileIntake.errors.displayName"));
        return false;
      }
      return true;
    }

    if (stepToValidate === 2) {
      if (!businessName.trim()) {
        setFieldError("businessName", t("pages:profileIntake.errors.businessName"));
        return false;
      }
      return true;
    }

    if (stepToValidate === 3) {
      let valid = true;
      if (projectTypes.length === 0) {
        setFieldError("projectTypes", t("pages:profileIntake.errors.projectTypes"));
        valid = false;
      }
      return valid;
    }

    if (stepToValidate === 4) {
      let valid = true;
      if (wantsSampleData === null) {
        setFieldError("sampleData", t("pages:profileIntake.sampleData.error"));
        valid = false;
      }
      return valid;
    }

    return true;
  };

  const handleSubmit = async () => {
    const trimmedName = displayName.trim();
    const trimmedBusiness = businessName.trim();
    const nextErrors: IntakeErrors = {};

    if (!trimmedName) {
      nextErrors.displayName = t("pages:profileIntake.errors.displayName");
    }

    if (!trimmedBusiness) {
      nextErrors.businessName = t("pages:profileIntake.errors.businessName");
    }

    if (projectTypes.length === 0) {
      nextErrors.projectTypes = t("pages:profileIntake.errors.projectTypes");
    }

    if (wantsSampleData === null) {
      nextErrors.sampleData = t("pages:profileIntake.sampleData.error");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);
      const profileResult = await updateProfile({ full_name: trimmedName });
      if (!profileResult?.success) {
        throw new Error("profile-update-failed");
      }

      const now = new Date().toISOString();
      const settingsResult = await updateSettings({
        photography_business_name: trimmedBusiness,
        preferred_project_types: projectTypes,
        profile_intake_completed_at: now,
        seed_sample_data_onboarding: wantsSampleData ?? false,
        preferred_locale: i18n.language ?? "en",
      });

      if (!settingsResult?.success) {
        throw settingsResult?.error ?? new Error("settings-update-failed");
      }

      await refreshSettings();
      logAuthEvent("auth_first_profile_intake_finish", {
        supabaseUserId: user?.id,
        businessNameLength: trimmedBusiness.length,
        projectTypesCount: projectTypes.length,
        defaultProjectType,
        loadSampleData: wantsSampleData ?? false,
      });

      toast({
        title: t("common:toast.success", { defaultValue: "Success" }),
        description: t("pages:profileIntake.toast.success"),
      });

      setManualComplete(true);
    } catch (error) {
      console.error("Profile intake submission failed", error);
      toast({
        title: t("common:toast.error", { defaultValue: "Error" }),
        description: t("pages:profileIntake.toast.error"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (isLastStep) {
      handleSubmit();
      return;
    }

    setDirection("forward");
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (currentStep === 1) {
      return;
    }
    setDirection("backward");
    setCurrentStep((prev) => prev - 1);
  };

  const renderOption = (option: ProjectTypeOption) => {
    const isSelected = projectTypes.includes(option.id);
    const Icon = option.icon;

    return (
      <button
        key={option.id}
        type="button"
        onClick={() => toggleProjectType(option.id)}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm text-center transition-all duration-200 ease-out transform",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary",
          "sm:justify-start sm:rounded-2xl sm:px-4 sm:py-3 sm:text-left sm:text-base sm:gap-3",
          isSelected
            ? "border-primary bg-primary/10 text-primary shadow-md sm:text-foreground sm:shadow-lg sm:translate-y-[-1px] scale-[1.02]"
            : "border-border/60 bg-muted/30 hover:bg-muted/60 hover:shadow-sm sm:hover:translate-y-[-1px] scale-100"
        )}
        aria-pressed={isSelected}
        data-selected={isSelected}
        data-testid={`profile-intake-project-${option.id}`}
      >
        <span
          className={cn(
            "sm:hidden transition-all duration-200",
            isSelected ? "scale-100 text-primary" : "scale-95 text-muted-foreground"
          )}
        >
          {isSelected ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Icon className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
        <span
          className={cn(
            "hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-background transition-all duration-200 sm:flex",
            isSelected ? "border-primary bg-primary/20 scale-100 shadow-sm" : "border-transparent scale-95"
          )}
        >
          {isSelected ? (
            <Check className="h-5 w-5 text-primary" />
          ) : (
            <Icon className="h-5 w-5 text-muted-foreground" />
          )}
        </span>
        <span
          className={cn(
            "font-semibold transition-colors duration-200",
            isSelected ? "text-primary sm:text-foreground" : "text-foreground"
          )}
        >
          {t(`pages:profileIntake.options.projectTypes.${option.id}`)}
        </span>
      </button>
    );
  };

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <section className="space-y-3">
          <Input
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              if (errors.displayName) {
                setFieldError("displayName", undefined);
              }
            }}
            placeholder={t("pages:profileIntake.displayName.placeholder")}
          />
          {errors.displayName && (
            <p className="text-xs text-destructive">{errors.displayName}</p>
          )}
        </section>
      );
    }

    if (currentStep === 2) {
      return (
        <section className="space-y-3">
          <Input
            value={businessName}
            onChange={(event) => {
              setBusinessName(event.target.value);
              if (errors.businessName) {
                setFieldError("businessName", undefined);
              }
            }}
            placeholder={t("pages:profileIntake.businessName.placeholder")}
          />
          {errors.businessName && (
            <p className="text-xs text-destructive">{errors.businessName}</p>
          )}
        </section>
      );
    }

    if (currentStep === 3) {
      return (
        <section className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("pages:profileIntake.projectTypes.helper")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {PROJECT_TYPE_OPTIONS.map((option) => renderOption(option))}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("pages:profileIntake.projectTypes.managementHint")}
          </div>
          {errors.projectTypes && (
            <p className="text-xs text-destructive">{errors.projectTypes}</p>
          )}
        </section>
      );
    }

    const sampleIntroTitle = t("pages:profileIntake.sampleData.title").trim();
    const sampleIntroDescription = t("pages:profileIntake.sampleData.description").trim();
    const showSampleIntro = Boolean(sampleIntroTitle || sampleIntroDescription);

    return (
      <section className="space-y-3">
        {showSampleIntro && (
          <div>
            {sampleIntroTitle && (
              <p className="text-sm font-medium text-foreground">
                {sampleIntroTitle}
              </p>
            )}
            {sampleIntroDescription && (
              <p className="text-xs text-muted-foreground">
                {sampleIntroDescription}
              </p>
            )}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {sampleDataOptions.map((option) => {
            const Icon = option.icon;
            const isActive = wantsSampleData === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  setWantsSampleData(option.value);
                  setFieldError("sampleData", undefined);
                }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/40"
                )}
                data-testid={`profile-intake-sample-${
                  option.value ? "yes" : "no"
                }`}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 mt-1 flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {option.title}
                    </p>
                    {option.recommended && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase tracking-wide bg-primary/15 text-primary border border-primary/20"
                      >
                        {t("pages:profileIntake.sampleData.recommended")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        {errors.sampleData && (
          <p className="text-xs text-destructive">{errors.sampleData}</p>
        )}
      </section>
    );
  };

  return (
    <Dialog open>
      <DialogContent
        hideClose
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl rounded-2xl border bg-background p-6 shadow-2xl"
        onPointerDownOutside={preventDialogDismiss}
        onInteractOutside={preventDialogDismiss}
        onEscapeKeyDown={preventDialogDismiss}
        data-testid="profile-intake-gate"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-xs font-semibold">
          <Sparkles className="h-4 w-4" />
          {t("pages:profileIntake.badge")}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              {currentStepMeta.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {currentStepMeta.description}
            </p>
          </div>
          <div
            key={currentStep}
            className={cn(
              "transform transition-all duration-300 ease-in-out",
              direction === "forward"
                ? "animate-in fade-in slide-in-from-bottom-2"
                : "animate-in fade-in slide-in-from-top-2"
            )}
          >
            {renderStepContent()}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t(currentFooterKey)}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={submitting}
                className="sm:min-w-[120px]"
              >
                {t("pages:profileIntake.actions.back")}
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={submitting}
              className="sm:min-w-[160px]"
            >
              {submitting && isLastStep
                ? t("pages:profileIntake.actions.saving")
                : isLastStep
                ? t("pages:profileIntake.actions.finish")
                : t("pages:profileIntake.actions.next")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProfileIntakeGate;
