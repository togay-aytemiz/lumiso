import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Check,
  Building2,
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
  Loader2,
} from "lucide-react";
import { canonicalizeProjectTypeSlug } from "@/lib/projectTypes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { logAuthEvent } from "@/lib/authTelemetry";
import { getEnvValue } from "@/lib/env";

const MAX_MULTI_SELECT = Infinity; // unlimited selections
const TOTAL_STEPS = 3;

const STEP_FOOTER_KEY_MAP: Record<number, string> = {
  1: "pages:profileIntake.footers.name",
  2: "pages:profileIntake.footers.business",
  3: "pages:profileIntake.footers.projects",
};

const isDevEnvironment = () => {
  if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
  ) {
    return true;
  }
  try {
    const meta = (0, eval)("import.meta") as
      | { env?: { DEV?: boolean } }
      | undefined;
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
  { id: "real_estate", icon: Building },
] as const satisfies ReadonlyArray<{ id: string; icon: LucideIcon }>;

type ProjectTypeOption = (typeof PROJECT_TYPE_OPTIONS)[number];
type ProjectTypeId = ProjectTypeOption["id"];

type IntakeErrors = {
  displayName?: string;
  businessName?: string;
  projectTypes?: string;
};

const FIELD_TO_STEP: Record<keyof IntakeErrors, number> = {
  displayName: 1,
  businessName: 2,
  projectTypes: 3,
};

const preventDialogDismiss = (event: Event) => {
  event.preventDefault();
};

type ProfileIntakeGateProps = {
  onVisibilityChange?: (isVisible: boolean) => void;
};

const useTypewriterPlaceholder = (variants: string[]) => {
  const [index, setIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [text, setText] = useState(() => variants[0] ?? "");

  useEffect(() => {
    setIndex(0);
    setIsDeleting(false);
    setText(variants[0] ?? "");
  }, [variants]);

  useEffect(() => {
    if (variants.length <= 1) return;
    const current = variants[index % variants.length] ?? "";
    const typeSpeed = 70;
    const deleteSpeed = 50;
    const holdDuration = 1700;
    const restartDelay = 420;
    const startDelay = 260;
    const isCurrentComplete = !isDeleting && text === current;
    const isResetting = isDeleting && text === "";
    const isStarting = !isDeleting && text === "";

    const updateText = () => {
      if (isCurrentComplete) {
        setIsDeleting(true);
        return;
      }

      if (isResetting) {
        setIsDeleting(false);
        setIndex((prev) => (prev + 1) % variants.length);
        return;
      }

      const target = variants[index % variants.length] ?? "";
      const next = isDeleting
        ? target.slice(0, Math.max(text.length - 1, 0))
        : target.slice(0, text.length + 1);
      setText(next);
    };

    const timeout = window.setTimeout(
      updateText,
      isCurrentComplete
        ? holdDuration
        : isResetting
        ? restartDelay
        : isStarting
        ? startDelay
        : isDeleting
        ? deleteSpeed
        : typeSpeed
    );

    return () => window.clearTimeout(timeout);
  }, [index, isDeleting, text, variants]);

  return text;
};

export function ProfileIntakeGate({
  onVisibilityChange,
}: ProfileIntakeGateProps) {
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const {
    settings,
    loading: settingsLoading,
    updateSettings,
    refreshSettings,
  } = useOrganizationSettings();
  const { activeOrganizationId, loading: organizationLoading } =
    useOrganization();
  const { user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const { t, i18n } = useTranslation(["pages", "common"]);

  const buildPlaceholders = useCallback(
    (key: "displayName" | "businessName") => {
      const base = t(`pages:profileIntake.${key}.placeholder`, {
        defaultValue: "",
      });
      const variants = t(`pages:profileIntake.${key}.placeholderVariants`, {
        returnObjects: true,
        defaultValue: [],
      }) as unknown;
      const list = Array.isArray(variants)
        ? variants.filter(
            (item): item is string => typeof item === "string" && item.trim()
          )
        : [];
      const unique: string[] = [];
      const addUnique = (value?: string) => {
        if (!value) return;
        if (!unique.includes(value)) {
          unique.push(value);
        }
      };
      addUnique(base);
      list.forEach((entry) => addUnique(entry.trim()));
      return unique.length > 0 ? unique : [base].filter(Boolean);
    },
    [t]
  );

  const displayNamePlaceholders = useMemo(
    () => buildPlaceholders("displayName"),
    [buildPlaceholders]
  );
  const businessNamePlaceholders = useMemo(
    () => buildPlaceholders("businessName"),
    [buildPlaceholders]
  );
  const animatedDisplayPlaceholder = useTypewriterPlaceholder(
    displayNamePlaceholders
  );
  const animatedBusinessPlaceholder = useTypewriterPlaceholder(
    businessNamePlaceholders
  );

  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [projectTypes, setProjectTypes] = useState<ProjectTypeId[]>([]);
  const [errors, setErrors] = useState<IntakeErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [manualComplete, setManualComplete] = useState(false);
  const [hasLoggedStart, setHasLoggedStart] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [hasEditedProjectTypes, setHasEditedProjectTypes] = useState(false);
  const defaultProjectType =
    canonicalizeProjectTypeSlug(projectTypes[0]) ?? projectTypes[0];

  const debugOverride = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!isDevEnvironment()) return false;
    const params = new URLSearchParams(location.search);
    return params.get("debugIntake") === "1";
  }, [location.search]);

  const needsDisplayName = !profile?.full_name?.trim();
  const needsBusinessName = !settings?.photography_business_name?.trim();
  const needsProjectTypes =
    (settings?.preferred_project_types?.length ?? 0) === 0;
  const hasCompletedIntakeOnce = Boolean(settings?.profile_intake_completed_at);

  const intakeComplete =
    hasCompletedIntakeOnce ||
    (!needsDisplayName && !needsBusinessName && !needsProjectTypes);

  const hasResolvedOrganization =
    Boolean(activeOrganizationId) && !organizationLoading;
  const readyForInitialData =
    hasResolvedOrganization && !profileLoading && !settingsLoading;
  const [initialDataLoaded, setInitialDataLoaded] = useState(
    () => readyForInitialData
  );

  useEffect(() => {
    if (!initialDataLoaded && readyForInitialData) {
      setInitialDataLoaded(true);
    }
  }, [initialDataLoaded, readyForInitialData]);

  const lastOrganizationIdRef = useRef<string | null>(
    activeOrganizationId ?? null
  );

  useEffect(() => {
    const previousOrgId = lastOrganizationIdRef.current;
    const currentOrgId = activeOrganizationId ?? null;

    if (previousOrgId === currentOrgId) {
      return;
    }

    lastOrganizationIdRef.current = currentOrgId;

    if ((previousOrgId && previousOrgId !== currentOrgId) || !currentOrgId) {
      setInitialDataLoaded(false);
    }
  }, [activeOrganizationId]);

  const shouldShow =
    initialDataLoaded && !manualComplete && (debugOverride || !intakeComplete);

  const isIntakeBlocking = initialDataLoaded ? shouldShow : true;

  useEffect(() => {
    if (!onVisibilityChange) return;

    // Keep parent layouts informed so onboarding modals can wait for intake to finish
    onVisibilityChange(isIntakeBlocking);
  }, [onVisibilityChange, isIntakeBlocking]);

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
    if (settingsLoading) return;
    setBusinessName(settings?.photography_business_name ?? "");
  }, [settings?.photography_business_name, settingsLoading]);

  useEffect(() => {
    if (settingsLoading) return;
    if (debugOverride || hasEditedProjectTypes) return;

    const preferred =
      settings?.preferred_project_types
        ?.map((type) => {
          const canonical = canonicalizeProjectTypeSlug(type);
          if (!canonical) return null;
          const match = PROJECT_TYPE_OPTIONS.find(
            (option) => option.id === canonical
          );
          return match?.id ?? null;
        })
        .filter((type): type is ProjectTypeId => Boolean(type)) ?? [];
    setProjectTypes(preferred);
  }, [
    settings?.preferred_project_types,
    settingsLoading,
    debugOverride,
    hasEditedProjectTypes,
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

  if (!initialDataLoaded || !shouldShow) {
    return null;
  }

  const setFieldError = (field: keyof IntakeErrors, message?: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  };

  const toggleProjectType = (value: ProjectTypeId) => {
    if (!hasEditedProjectTypes) {
      setHasEditedProjectTypes(true);
    }
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
        setFieldError(
          "displayName",
          t("pages:profileIntake.errors.displayName")
        );
        return false;
      }
      return true;
    }

    if (stepToValidate === 2) {
      if (!businessName.trim()) {
        setFieldError(
          "businessName",
          t("pages:profileIntake.errors.businessName")
        );
        return false;
      }
      return true;
    }

    if (stepToValidate === 3) {
      let valid = true;
      if (projectTypes.length === 0) {
        setFieldError(
          "projectTypes",
          t("pages:profileIntake.errors.projectTypes")
        );
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

    setErrors(nextErrors);
    const errorFields = Object.keys(nextErrors) as (keyof IntakeErrors)[];
    if (errorFields.length > 0) {
      const firstField = errorFields[0];
      const targetStep = FIELD_TO_STEP[firstField];
      if (targetStep && targetStep !== currentStep) {
        setDirection(targetStep < currentStep ? "backward" : "forward");
        setCurrentStep(targetStep);
      }
      const firstMessage = nextErrors[firstField];
      if (firstMessage) {
        toast({
          title: t("common:toast.error", { defaultValue: "Error" }),
          description: firstMessage,
          variant: "destructive",
        });
      }
      return;
    }

    try {
      setSubmitting(true);
      const normalizedProjectTypes = Array.from(
        new Set(
          projectTypes
            .map((type) => canonicalizeProjectTypeSlug(type) ?? type)
            .filter((type): type is string => Boolean(type))
        )
      );
      const profileResult = await updateProfile({ full_name: trimmedName });
      if (!profileResult?.success) {
        throw new Error("profile-update-failed");
      }

      const now = new Date().toISOString();
      const settingsResult = await updateSettings({
        photography_business_name: trimmedBusiness,
        preferred_project_types: normalizedProjectTypes,
        profile_intake_completed_at: now,
        preferred_locale: i18n.language ?? "en",
      });

      if (!settingsResult?.success) {
        throw settingsResult?.error ?? new Error("settings-update-failed");
      }

      await refreshSettings();

      if (!hasCompletedIntakeOnce && activeOrganizationId) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const functionsBase =
          getEnvValue("VITE_SUPABASE_URL") ||
          "https://rifdykpdubrowzbylffe.supabase.co";

        if (accessToken) {
          // Fire-and-forget with keepalive so it survives tab close
          fetch(`${functionsBase}/functions/v1/send-welcome-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              organizationId: activeOrganizationId,
              locale: i18n.language,
            }),
            keepalive: true,
          }).catch((error) => {
            console.warn("Welcome email failed:", error);
          });
        }
      }

      logAuthEvent("auth_first_profile_intake_finish", {
        supabaseUserId: user?.id,
        businessNameLength: trimmedBusiness.length,
        projectTypesCount: normalizedProjectTypes.length,
        defaultProjectType,
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
            isSelected
              ? "scale-100 text-primary"
              : "scale-95 text-muted-foreground"
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
            isSelected
              ? "border-primary bg-primary/20 scale-100 shadow-sm"
              : "border-transparent scale-95"
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
            placeholder={animatedDisplayPlaceholder}
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
            placeholder={animatedBusinessPlaceholder}
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

    return null;
  };

  return (
    <Dialog open>
      <DialogContent
        hideClose
        className="w-full max-w-[calc(100vw-2rem)] max-h-[calc(100vh-1.5rem)] overflow-y-auto sm:max-w-3xl sm:max-h-none sm:overflow-visible rounded-2xl border bg-background p-5 sm:p-6 shadow-2xl"
        onPointerDownOutside={preventDialogDismiss}
        onInteractOutside={preventDialogDismiss}
        onEscapeKeyDown={preventDialogDismiss}
        data-testid="profile-intake-gate"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("pages:profileIntake.title")}</DialogTitle>
          <DialogDescription>
            {t("pages:profileIntake.subtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          {t("pages:profileIntake.badge")}
        </div>

        <div className="space-y-2 sm:mt-3 sm:space-y-2">
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

        <div className="mt-3 flex flex-col gap-2 sm:gap-3 sm:mt-4 sm:border-t sm:border-border/60 sm:pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={cn(
              "text-sm text-muted-foreground",
              currentStep === 3 ? "hidden sm:block" : undefined
            )}
          >
            {t(currentFooterKey)}
          </p>
          <div className="flex w-full flex-row gap-2 sm:w-auto sm:items-center sm:gap-3">
            {currentStep > 1 && (
              <Button
                variant="surface"
                onClick={handleBack}
                disabled={submitting}
                className="flex-1 sm:flex-none sm:min-w-[120px]"
              >
                {t("pages:profileIntake.actions.back")}
              </Button>
            )}
            <Button
              variant="surface"
              onClick={handleNext}
              disabled={submitting}
              className="btn-surface-accent flex-1 sm:flex-none sm:min-w-[160px]"
            >
              {submitting && isLastStep ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pages:profileIntake.actions.saving")}
                </>
              ) : isLastStep ? (
                t("pages:profileIntake.actions.finish")
              ) : (
                t("pages:profileIntake.actions.next")
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProfileIntakeGate;
