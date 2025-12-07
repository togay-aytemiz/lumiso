import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";  
import { Badge } from "@/components/ui/badge";
import { HelpCircle, ArrowRight, ArrowRightCircle, CheckCircle, Clock, Sparkles, CircleOff } from "lucide-react";
import { SampleDataModal } from "@/components/SampleDataModal";
import { RestartGuidedModeButton } from "@/components/RestartGuidedModeButton";
import { ExitGuidanceModeButton } from "@/components/ExitGuidanceModeButton";
import { GuidedStepProgress } from "@/components/GuidedStepProgress";
import { HelpModal } from "@/components/modals/HelpModal";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useTranslation } from "react-i18next";
import { ONBOARDING_STEPS } from "@/constants/onboarding";
import { BaseOnboardingModal } from "@/components/shared/BaseOnboardingModal";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { canonicalizeProjectTypeSlug } from "@/lib/projectTypes";

type ConfettiPiece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
  size: number;
};

type ConfettiPieceStyle = CSSProperties & {
  "--confetti-drift"?: string;
};

const CONFETTI_COLORS = ["#1EB29F", "#34D399", "#FBBF24", "#F472B6", "#60A5FA"];

const createConfettiPieces = (count = 36): ConfettiPiece[] =>
  Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2.6 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 60,
    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
    size: 0.6 + Math.random() * 0.8
  }));

const COMPLETED_DISPLAY_ORDER = ONBOARDING_STEPS.map((step) => step.id);

// Remove duplicate step definitions - now using centralized ones from hook

const GettingStarted = () => {
  const { t } = useTranslation('pages');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showSampleDataModal, setShowSampleDataModal] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [showCompletionChoice, setShowCompletionChoice] = useState(false);
  const [completionChoice, setCompletionChoice] = useState<"sample" | "clean" | null>(null);
  const [isSubmittingChoice, setIsSubmittingChoice] = useState(false);
  const { 
    stage,
    loading, 
    isInGuidedSetup, 
    isOnboardingComplete,
    currentStepInfo,
    nextStepInfo,
    completedSteps,
    isAllStepsComplete,
    totalSteps,
    currentStep,
    completeOnboarding
  } = useOnboarding();
  const { activeOrganizationId } = useOrganization();
  const { settings, updateSettings, refreshSettings } = useOrganizationSettings();
  const { toast: showToast } = useToast();
  const completionBannerRef = useRef<HTMLDivElement | null>(null);
  const orderedCompletedSteps = useMemo(() => {
    if (!completedSteps.length) return [];
    const orderMap = new Map(COMPLETED_DISPLAY_ORDER.map((stepId, index) => [stepId, index]));
    const fallbackStart = COMPLETED_DISPLAY_ORDER.length;
    return [...completedSteps].sort((a, b) => {
      const indexA = orderMap.get(a.id) ?? fallbackStart + a.id;
      const indexB = orderMap.get(b.id) ?? fallbackStart + b.id;
      return indexA - indexB;
    });
  }, [completedSteps]);
  const hasCompletedAnyStep = completedSteps.length > 0;
  const isOnFinalStep = !isAllStepsComplete && currentStep === totalSteps;
  const startOptions = [
    {
      value: "sample" as const,
      icon: Sparkles,
      title: t("onboarding.sample_data.options.sample.title"),
      description: t("onboarding.sample_data.options.sample.description"),
      recommended: true
    },
    {
      value: "clean" as const,
      icon: CircleOff,
      title: t("onboarding.sample_data.options.clean.title"),
      description: t("onboarding.sample_data.options.clean.description"),
      recommended: false
    }
  ];

  // If guided setup is complete, redirect to dashboard
  useEffect(() => {
    if (!loading && stage !== "in_progress" && !isAllStepsComplete && (!isInGuidedSetup || isOnboardingComplete)) {
      navigate('/', { replace: true });
    }
  }, [loading, stage, isAllStepsComplete, isInGuidedSetup, isOnboardingComplete, navigate]);
  
  // Handle completion
  const handleComplete = async () => {
    setCompletionChoice(null);
    setShowCompletionChoice(true);
  };

  // Animation on mount and when currentStep changes
  useEffect(() => {
    if (!loading) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [currentStep, loading]);

  // Celebrate when onboarding steps are all complete
  useEffect(() => {
    if (!isAllStepsComplete || hasCelebrated) {
      return;
    }

    setHasCelebrated(true);
    const scrollTarget = completionBannerRef.current;
    if (scrollTarget && typeof scrollTarget.scrollIntoView === "function") {
      scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setConfettiPieces(createConfettiPieces());
    setShowConfetti(true);

    const timer = window.setTimeout(() => setShowConfetti(false), 4500);

    return () => clearTimeout(timer);
  }, [isAllStepsComplete, hasCelebrated]);

  const ensureSeedPreference = async (value: boolean) => {
    if (!settings?.organization_id && !activeOrganizationId) {
      throw new Error("missing-organization");
    }
    if (settings?.seed_sample_data_onboarding === value) return;
    const result = await updateSettings({ seed_sample_data_onboarding: value });
    if (!result?.success) {
      throw result?.error ?? new Error("failed-to-update-settings");
    }
    await refreshSettings();
  };

  const seedSampleData = async () => {
    if (!user?.id) throw new Error("missing-user");
    const orgId = settings?.organization_id ?? activeOrganizationId;
    if (!orgId) throw new Error("missing-organization");

    const preferredSlugs = (settings?.preferred_project_types ?? [])
      .map((slug) => canonicalizeProjectTypeSlug(slug))
      .filter((slug): slug is string => Boolean(slug));
    const locale = settings?.preferred_locale ?? "tr";

    const { error } = await supabase.rpc("seed_sample_data_for_org", {
      owner_uuid: user.id,
      org_id: orgId,
      final_locale: locale,
      preferred_slugs: preferredSlugs,
    });

    if (error) {
      throw error;
    }
  };

  const handleCompletionChoiceSubmit = async () => {
    if (!completionChoice || isSubmittingChoice) return;
    setIsSubmittingChoice(true);
    try {
      if (completionChoice === "sample") {
        await ensureSeedPreference(true);
        await seedSampleData();
      } else {
        await ensureSeedPreference(false);
      }

      await completeOnboarding();
      setShowCompletionChoice(false);
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Error finishing onboarding choice:", error);
      showToast({
        title: t('onboarding.sample_data.toast.error_title', { defaultValue: "Bir şeyler ters gitti" }),
        description: t('onboarding.sample_data.toast.error_description', { defaultValue: "Lütfen tekrar deneyin." }),
        variant: "destructive"
      });
      setIsSubmittingChoice(false);
    }
  };

  const handleStepAction = (step: (typeof ONBOARDING_STEPS)[number]) => {
    navigate(step.route);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">{t('onboarding.getting_started.loading')}</div>;
  }

  const pageBackgroundClass = isAllStepsComplete
    ? "bg-gradient-to-br from-[#f6fbff] via-[#f7f9ff] to-[#f5fff9]"
    : "bg-background";

  return (
    <div className={`min-h-screen ${pageBackgroundClass}`}>
      {!isAllStepsComplete && (
        <div className="bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-6 gap-6">
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t('onboarding.getting_started.welcome_title')}</h1>
                <p className="text-sm text-muted-foreground mt-2">{t('onboarding.getting_started.welcome_subtitle')}</p>
              </div>
              <div className="flex items-center justify-center sm:justify-end gap-3">
                <Button variant="surface" size="sm" onClick={() => setIsHelpModalOpen(true)}>
                  <HelpCircle className="w-4 h-4 mr-2" />
                  {t('onboarding.getting_started.need_help')}
                </Button>
                <Button 
                  variant="surface" 
                  size="sm"
                  onClick={() => setShowSampleDataModal(true)}
                >
                  <ArrowRightCircle className="w-4 h-4 mr-2" />
                  {t('onboarding.getting_started.skip_setup')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-safe">
        {/* Progress Section */}
        {hasCompletedAnyStep && (
          <div className={`mb-4 sm:mb-8 ${isAnimating ? 'animate-fade-in' : ''}`}>
            <Card className="border-none shadow-lg rounded-2xl">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-xl">
                    {t('onboarding.getting_started.setup_progress')}
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </CardTitle>
                  {isOnFinalStep && (
                    <Badge variant="success" className="flex flex-col items-start px-3 py-1.5 text-xs sm:text-[13px] leading-tight">
                      <span className="flex items-center gap-1 font-semibold">
                        {t('onboarding.getting_started.final_step_chip_title')}
                      </span>
                      <span className="font-normal text-[11px] sm:text-xs">
                        {t('onboarding.getting_started.final_step_chip_subtitle')}
                      </span>
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  <GuidedStepProgress 
                    currentValue={currentStep - 1}
                    targetValue={currentStep - 1}
                    totalSteps={totalSteps}
                    animate={true}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Learning Path Header */}
        {!isAllStepsComplete && (
          <div className="mb-6 sm:mb-8 text-center">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
              {t('onboarding.getting_started.your_learning_path')}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              {t('onboarding.getting_started.learning_path_subtitle')}
            </p>
          </div>
        )}

        {/* Completed Steps */}
        {orderedCompletedSteps.length > 0 && (
          <div className={`mb-4 ${isAnimating ? 'animate-scale-in' : ''}`}>
            <div className="space-y-2">
              {orderedCompletedSteps.map((step) => (
                <div key={step.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white flex-shrink-0">
                    <CheckCircle className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">
                      {t(`onboarding.steps.step_${step.id}.title`)}
                    </p>
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium flex-shrink-0">
                    ✓
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Task */}
        {currentStepInfo && (
          <div className={`mb-6 sm:mb-8 ${isAnimating ? 'animate-fade-in' : ''}`}>
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3">
                    <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground text-lg font-bold animate-pulse shrink-0 leading-none">
                      {currentStepInfo.id}
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t(`onboarding.steps.step_${currentStepInfo.id}.duration`)}
                      </span>
                      <CardTitle className="text-base sm:text-lg md:text-xl leading-tight">
                        {t(`onboarding.steps.step_${currentStepInfo.id}.title`)}
                      </CardTitle>
                      <CardDescription className="text-sm md:text-base text-muted-foreground leading-relaxed">
                        {t(`onboarding.steps.step_${currentStepInfo.id}.description`)}
                      </CardDescription>
                      <div className="pt-2">
                        <Button 
                          size="lg"
                          onClick={() => handleStepAction(currentStepInfo)}
                          className="w-full sm:w-auto justify-center hover-scale"
                        >
                          {t(`onboarding.steps.step_${currentStepInfo.id}.button`)}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Next Step Preview */}
        {nextStepInfo && (
          <div className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px bg-border flex-1"></div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide px-3">{t('onboarding.getting_started.coming_next')}</span>
              <div className="h-px bg-border flex-1"></div>
            </div>
            
            <Card className="bg-muted/20">
              <CardContent className="p-4 md:p-6">
                {/* Mobile-first responsive layout for next step preview */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex items-center justify-center w-11 h-11 rounded-full border-2 border-muted-foreground/30 text-muted-foreground text-lg font-bold flex-shrink-0">
                        {nextStepInfo.id}
                      </div>
                      <div className="flex-1 space-y-2">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t(`onboarding.steps.step_${nextStepInfo.id}.duration`)}
                        </span>
                        <CardTitle className="text-base sm:text-lg text-muted-foreground leading-tight">
                          {t(`onboarding.steps.step_${nextStepInfo.id}.title`)}
                        </CardTitle>
                        <CardDescription className="text-sm sm:text-base text-muted-foreground/80 leading-relaxed">
                          {t(`onboarding.steps.step_${nextStepInfo.id}.description`)}
                        </CardDescription>
                        <div className="pt-1">
                          <Button 
                            size="lg"
                            variant="outline"
                            disabled
                            className="opacity-50 w-full sm:w-auto"
                          >
                            {t(`onboarding.steps.step_${nextStepInfo.id}.button`)}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Completion */}
        {isAllStepsComplete && (
          <div className={`text-center ${isAnimating ? 'animate-scale-in' : ''}`} ref={completionBannerRef}>
            <div className="mx-auto max-w-2xl rounded-3xl bg-white/60 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm border border-white/70 px-6 py-10 sm:px-10 sm:py-14">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl sm:text-3xl font-bold text-green-700 mb-3">
                {t('onboarding.getting_started.congratulations')}
              </h2>
              <p className="text-base sm:text-lg text-foreground/80 mb-8">
                {t('onboarding.getting_started.setup_complete')}
              </p>
              <Button 
                size="lg"
                variant="surface"
                className="btn-surface-accent hover-scale"
                onClick={handleComplete}
                disabled={isSubmittingChoice}
              >
                {isSubmittingChoice
                  ? t("onboarding.sample_data.starting", { defaultValue: "Hazırlanıyor..." })
                  : t('onboarding.getting_started.go_to_dashboard')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <SampleDataModal 
        open={showSampleDataModal}
        onClose={() => setShowSampleDataModal(false)}
      />

      <HelpModal isOpen={isHelpModalOpen} onOpenChange={setIsHelpModalOpen} />

      <BaseOnboardingModal
        open={showCompletionChoice}
        onClose={() => setShowCompletionChoice(false)}
        title={t("onboarding.sample_data.choice_title", { defaultValue: "Nasıl devam etmek istersin?" })}
        description={t("onboarding.sample_data.choice_description", { defaultValue: "Eğitimi kapatmak için örnek verilerle keşfetmeyi ya da temiz başlamayı seç." })}
        actions={[
          {
            label: isSubmittingChoice
              ? t("onboarding.sample_data.starting", { defaultValue: "Hazırlanıyor..." })
              : t('onboarding.getting_started.go_to_dashboard'),
            onClick: handleCompletionChoiceSubmit,
            variant: "surface",
            className: "btn-surface-accent",
            disabled: isSubmittingChoice || !completionChoice,
            tooltip: !completionChoice
              ? {
                  content: t("onboarding.sample_data.select_option_tooltip", { defaultValue: "Devam etmek için bir seçenek seç." }),
                  variant: "dark"
                }
              : undefined
          }
        ]}
        size="compact"
      >
        <div className="space-y-3">
          {startOptions.map((option) => {
            const Icon = option.icon;
            const active = completionChoice === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setCompletionChoice(option.value)}
                disabled={isSubmittingChoice}
                className={`w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-muted/30 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`rounded-full p-2 ${option.value === "sample" ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted/50"}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground">{option.title}</p>
                      {option.recommended && (
                        <Badge variant="success" className="text-[11px] font-semibold">
                          {t("onboarding.sample_data.recommended", { defaultValue: "Önerilen" })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </BaseOnboardingModal>

      <RestartGuidedModeButton />
      <ExitGuidanceModeButton />
      {showConfetti && (
        <div className="confetti-container" aria-hidden="true">
          {confettiPieces.map((piece) => {
            const pieceStyle: ConfettiPieceStyle = {
              left: `${piece.left}%`,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              backgroundColor: piece.color,
              width: `${piece.size * 8}px`,
              height: `${piece.size * 14}px`,
              "--confetti-drift": `${piece.drift}vw`
            };

            return <span key={piece.id} className="confetti-piece" style={pieceStyle} />;
          })}
        </div>
      )}
    </div>
  );
};

export default GettingStarted;
