import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SESSION_PLANNING_STEPS } from "../state/sessionPlanningReducer";
import { useSessionPlanningActions } from "../hooks/useSessionPlanningActions";
import { useSessionPlanningContext } from "../hooks/useSessionPlanningContext";
import { SessionPlanningStepId } from "../types";
import { LeadStep } from "../steps/LeadStep";
import { ProjectStep } from "../steps/ProjectStep";
import { SessionTypeStep } from "../steps/SessionTypeStep";
import { LocationStep } from "../steps/LocationStep";
import { ScheduleStep } from "../steps/ScheduleStep";
import { NotesStep } from "../steps/NotesStep";
import { SummaryStep } from "../steps/SummaryStep";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { useSessionTypes } from "@/hooks/useOrganizationData";
import { useOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useToast } from "@/components/ui/use-toast";
import { trackEvent } from "@/lib/telemetry";

interface SessionPlanningWizardProps {
  onCancel: () => void;
  onComplete: () => void;
  isCompleting?: boolean;
}

const STEP_COMPONENTS: Record<SessionPlanningStepId, () => JSX.Element> = {
  lead: LeadStep,
  project: ProjectStep,
  sessionType: SessionTypeStep,
  location: LocationStep,
  schedule: ScheduleStep,
  notes: NotesStep,
  summary: SummaryStep,
};

export const SessionPlanningWizard = ({
  onComplete,
  isCompleting,
}: SessionPlanningWizardProps) => {
  const { state } = useSessionPlanningContext();
  const { meta } = state;
  const { setCurrentStep, setDefaultSessionType } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");
  const { data: sessionTypes = [] } = useSessionTypes();
  const { settings } = useOrganizationSettings();
  const { toast } = useToast();

  const rawIndex = useMemo(
    () =>
      SESSION_PLANNING_STEPS.findIndex((step) => step.id === meta.currentStep),
    [meta.currentStep]
  );
  const currentIndex = rawIndex < 0 ? 0 : rawIndex;

  const CurrentStepComponent = useMemo(
    () => STEP_COMPONENTS[meta.currentStep],
    [meta.currentStep]
  );
  const isFirstStep = currentIndex <= 0;
  const isLastStep = currentIndex >= SESSION_PLANNING_STEPS.length - 1;
  const totalSteps = SESSION_PLANNING_STEPS.length;
  const progressValue =
    totalSteps === 0 ? 0 : Math.round(((currentIndex + 1) / totalSteps) * 100);
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const activeSessionTypes = useMemo(
    () => sessionTypes.filter((type) => type?.is_active !== false),
    [sessionTypes]
  );
  const viewedStepRef = useRef<SessionPlanningStepId | null>(null);

  useEffect(() => {
    if (state.sessionTypeId) return;
    if (!activeSessionTypes.length) return;

    const defaultId = settings?.default_session_type_id ?? null;
    const recommended =
      (defaultId && activeSessionTypes.find((type) => type.id === defaultId)) ||
      activeSessionTypes[0];

    if (recommended) {
      setDefaultSessionType({
        id: recommended.id,
        label: recommended.name,
      });
    }
  }, [
    state.sessionTypeId,
    activeSessionTypes,
    settings?.default_session_type_id,
    setDefaultSessionType,
  ]);

  useEffect(() => {
    const stepId = meta.currentStep;
    if (viewedStepRef.current === stepId) {
      return;
    }
    viewedStepRef.current = stepId;
    trackEvent("session_wizard_step_viewed", {
      stepId,
      entrySource: state.meta.entrySource ?? "direct",
    });
  }, [meta.currentStep, state.meta.entrySource]);

  const stepStatus = useMemo(() => {
    const toSummary = (value?: string | null) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    };

    const getScheduleSummary = () => {
      if (!state.schedule.date && !state.schedule.time) {
        return undefined;
      }

      if (state.schedule.date && state.schedule.time) {
        return `${state.schedule.date} • ${state.schedule.time}`;
      }

      if (state.schedule.date) {
        return `${state.schedule.date} • ${t("summary.values.timeTbd")}`;
      }

      if (state.schedule.time) {
        return `${t("summary.values.dateTbd")} • ${state.schedule.time}`;
      }

      return undefined;
    };

    const trimmedNotes = toSummary(state.notes);
    const notesSummary = trimmedNotes
      ? trimmedNotes.length > 80
        ? `${trimmedNotes.slice(0, 80)}…`
        : trimmedNotes
      : undefined;

    const leadSummary = toSummary(state.lead.name);
    const hasLead = Boolean(state.lead.id || state.lead.name?.trim());

    const projectSummary = toSummary(state.project.name);
    const hasProject = Boolean(state.project.id || state.project.name?.trim());

    const sessionTypeSummary = toSummary(state.sessionTypeLabel);
    const hasSessionType = Boolean(state.sessionTypeId);

    const locationSummary =
      toSummary(state.location) ??
      toSummary(state.meetingUrl) ??
      toSummary(state.locationLabel);
    const hasLocation = Boolean(
      state.locationLabel?.trim() ||
        state.location?.trim() ||
        state.meetingUrl?.trim()
    );

    const scheduleSummary = getScheduleSummary();
    const hasSchedule = Boolean(state.schedule.date && state.schedule.time);

    const hasNotes = Boolean(notesSummary);

    const summaryName = toSummary(state.sessionName);
    const hasSummaryName = Boolean(summaryName);

    return {
      lead: { summary: leadSummary, hasValue: hasLead },
      project: { summary: projectSummary, hasValue: hasProject },
      sessionType: { summary: sessionTypeSummary, hasValue: hasSessionType },
      location: { summary: locationSummary, hasValue: hasLocation },
      schedule: { summary: scheduleSummary, hasValue: hasSchedule },
      notes: { summary: notesSummary, hasValue: hasNotes },
      summary: { summary: summaryName, hasValue: hasSummaryName },
    } satisfies Record<
      SessionPlanningStepId,
      { summary?: string; hasValue: boolean }
    >;
  }, [state, t]);

  const goToStep = (index: number) => {
    const target = SESSION_PLANNING_STEPS[index];
    if (!target) return;

    if (index > currentIndex) {
      const currentStep = SESSION_PLANNING_STEPS[currentIndex];
      trackEvent("session_wizard_step_completed", {
        stepId: currentStep.id,
        entrySource: state.meta.entrySource ?? "direct",
      });
    } else if (index < currentIndex) {
      trackEvent("session_wizard_step_revisited", {
        stepId: target.id,
        fromStep: SESSION_PLANNING_STEPS[currentIndex].id,
        entrySource: state.meta.entrySource ?? "direct",
      });
    }

    setCurrentStep(target.id);
  };

  const handleMobileSelect = (index: number) => {
    goToStep(index);
    setMobileStepsOpen(false);
  };

  const handleNextStep = () => {
    const nextIndex = Math.min(SESSION_PLANNING_STEPS.length - 1, currentIndex + 1);
    if (nextIndex === currentIndex) return;

    if (meta.currentStep === "schedule") {
      if (!state.schedule.date || !state.schedule.time) {
        toast({
          title: t("validation.missingSchedule"),
          variant: "destructive",
        });
        return;
      }
    }

    goToStep(nextIndex);
  };

  const currentStepConfig = SESSION_PLANNING_STEPS[currentIndex];
  const currentStepLabel = currentStepConfig
    ? t(currentStepConfig.labelKey)
    : "";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-slate-50 lg:p-0">
      <div className="flex flex-1 flex-col lg:flex-row lg:items-stretch lg:gap-0">
        <aside className="relative hidden w-full max-w-xs flex-col overflow-hidden text-slate-100 lg:flex lg:rounded-3xl xl:max-w-sm">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -inset-28 opacity-90 blur-3xl bg-[radial-gradient(900px_500px_at_20%_10%,rgba(16,185,129,0.35),transparent_65%),radial-gradient(720px_520px_at_80%_-10%,rgba(6,182,212,0.24),transparent_60%),radial-gradient(880px_680px_at_50%_95%,rgba(59,130,246,0.18),transparent_65%)]" />
            <div className="absolute -bottom-24 left-6 h-60 w-60 rounded-full bg-emerald-400/35 blur-3xl float-slow" />
            <div className="absolute top-20 right-4 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl float-slow [animation-delay:1s]" />
            <div className="absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl float-slow [animation-delay:2.4s]" />
          </div>
          <div className="absolute inset-0 bg-slate-950/80" />
          <div className="relative flex h-full flex-col gap-8 overflow-y-auto overflow-x-hidden px-6 py-10">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                {t("stepper.progressLabel", {
                  current: currentIndex + 1,
                  total: totalSteps,
                })}
              </p>
              <Progress value={progressValue} className="h-2 bg-white/10" />
              <p className="text-sm font-medium tracking-tight text-slate-200">
                {currentStepLabel}
              </p>
            </div>
            <StepList
              currentIndex={currentIndex}
              onSelectStep={goToStep}
              statuses={stepStatus}
              translate={t}
              variant="desktop"
            />
          </div>
        </aside>

        <div className="flex flex-1 min-h-0 min-w-0 flex-col">
          <div className="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur lg:hidden">
            <Collapsible
              open={mobileStepsOpen}
              onOpenChange={setMobileStepsOpen}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("stepper.progressLabel", {
                      current: currentIndex + 1,
                      total: totalSteps,
                    })}
                  </p>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {currentStepLabel}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {t(`steps.${meta.currentStep}.description`)}
                    </p>
                  </div>
                </div>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="group flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100"
                  >
                    <span>
                      {mobileStepsOpen
                        ? t("stepper.hideSteps")
                        : t("stepper.showSteps")}
                    </span>
                    <ChevronDown className="h-4 w-4 transition group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
              </div>
              <Progress value={progressValue} className="mt-4" />
              <CollapsibleContent className="mt-6 space-y-3 overflow-x-hidden">
                <StepList
                  currentIndex={currentIndex}
                  onSelectStep={handleMobileSelect}
                  statuses={stepStatus}
                  translate={t}
                  variant="mobile"
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                <Button
                  variant="outline"
                  onClick={() => goToStep(Math.max(0, currentIndex - 1))}
                  disabled={isFirstStep}
                  className="w-full sm:w-auto sm:px-6"
                >
                  {t("wizard.back")}
                </Button>
                {!isLastStep ? (
                  <Button
                    onClick={handleNextStep}
                    className="w-full sm:w-auto sm:px-8"
                  >
                    {t("wizard.next")}
                  </Button>
                ) : (
                  <Button
                    onClick={onComplete}
                    disabled={isCompleting}
                    aria-busy={isCompleting}
                    className="w-full sm:w-auto sm:px-8"
                  >
                    {isCompleting
                      ? t("wizard.confirming")
                      : t("wizard.confirm")}
                  </Button>
                )}
              </div>
              <div
                key={meta.currentStep}
                className="animate-in fade-in slide-in-from-bottom-2 rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-xl shadow-slate-900/5 backdrop-blur"
              >
                {meta.currentStep === "project" ? (
                  <ProjectStep onContinue={() => goToStep(Math.min(SESSION_PLANNING_STEPS.length - 1, currentIndex + 1))} />
                ) : (
                  <CurrentStepComponent />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const REQUIRED_STEPS: Record<SessionPlanningStepId, boolean> = {
  lead: true,
  project: true,
  sessionType: true,
  location: true,
  schedule: true,
  notes: false,
  summary: false,
};

interface StepListProps {
  currentIndex: number;
  onSelectStep: (index: number) => void;
  statuses: Record<SessionPlanningStepId, { summary?: string; hasValue: boolean }>;
  translate: (key: string, options?: Record<string, unknown>) => string;
  variant: "desktop" | "mobile";
}

const StepList = ({
  currentIndex,
  onSelectStep,
  statuses,
  translate,
  variant,
}: StepListProps) => (
  <ol
    className={cn(
      "flex max-w-full flex-col overflow-x-hidden",
      variant === "desktop" ? "gap-4" : "gap-3"
    )}
  >
    {SESSION_PLANNING_STEPS.map((step, index) => {
      const isActive = index === currentIndex;
      const status = statuses[step.id] ?? { summary: undefined, hasValue: false };
      const summary = status.summary;
      const hasValue = status.hasValue;
      const isComplete = index < currentIndex && hasValue;
      const requiresAttention = REQUIRED_STEPS[step.id] ?? false;
      const needsAttention = !isActive && requiresAttention && index < currentIndex && !hasValue;
      const description = translate(`steps.${step.id}.description`);
      const isSummaryStep = step.id === "summary";
      const supportingText = !isSummaryStep
        ? summary ?? description
        : undefined;
      const alignmentClass = supportingText ? "items-start" : "items-center";

      return (
        <li key={step.id}>
          <button
            type="button"
            onClick={() => onSelectStep(index)}
            className={cn(
              "group relative flex w-full max-w-full flex-col overflow-hidden rounded-3xl border px-4 py-4 text-left transition-all",
              variant === "desktop"
                ? cn(
                    "border-white/10 bg-white/5 text-white/90 shadow-sm hover:border-white/30 hover:bg-white/10",
                    isActive &&
                      "border-white/60 bg-white/15 shadow-lg shadow-slate-900/20",
                    isComplete &&
                      "border-emerald-400/50 bg-emerald-400/10 text-emerald-50 hover:border-emerald-300 hover:bg-emerald-400/20",
                    needsAttention &&
                      "border-amber-300/70 bg-amber-200/15 text-amber-100 hover:border-amber-200 hover:bg-amber-200/25"
                  )
                : cn(
                    "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:bg-slate-50",
                    isActive && "border-slate-900/20 bg-slate-900/5 shadow-md",
                    isComplete &&
                      "border-emerald-400 bg-emerald-500/20 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-500/30",
                    needsAttention &&
                      "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100"
                  )
            )}
          >
            <div className={cn("flex gap-3", alignmentClass)}>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition",
                  variant === "desktop"
                    ? cn(
                        "border-white/40 text-white/80",
                        isActive &&
                          "border-white bg-white text-slate-900 shadow",
                        isComplete &&
                          "border-emerald-300 bg-emerald-400/20 text-emerald-950",
                        needsAttention &&
                          "border-amber-200 bg-amber-300/30 text-amber-900"
                      )
                    : cn(
                        "border-slate-300 text-slate-600",
                        isActive && "border-slate-900 bg-slate-900 text-white",
                        isComplete &&
                          "border-emerald-400 bg-emerald-500/20 text-emerald-700",
                        needsAttention &&
                          "border-amber-300 bg-amber-100 text-amber-900"
                      )
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : needsAttention ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold tracking-tight",
                    variant === "desktop"
                      ? needsAttention
                        ? "text-amber-100"
                        : "text-white"
                      : needsAttention
                        ? "text-amber-900"
                        : "text-slate-900"
                  )}
                >
                  {translate(step.labelKey)}
                </p>
                {supportingText && (
                  <p
                    className={cn(
                      "mt-1 text-xs truncate leading-relaxed",
                      variant === "desktop"
                        ? needsAttention
                          ? "text-amber-100/80"
                          : "text-white/90"
                        : needsAttention
                          ? "text-amber-800"
                          : "text-slate-700"
                    )}
                  >
                    {supportingText}
                  </p>
                )}
              </div>
            </div>
          </button>
        </li>
      );
    })}
  </ol>
);
