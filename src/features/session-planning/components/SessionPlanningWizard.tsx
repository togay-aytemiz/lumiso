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
  const isEditing = state.meta.mode === "edit";
  const [visitedSteps, setVisitedSteps] = useState<
    Set<SessionPlanningStepId>
  >(() => new Set());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
    if (isEditing) return;
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
    isEditing,
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

    const projectSkipped = state.project.isSkipped === true;
    const hasProjectValue = Boolean(state.project.id || state.project.name?.trim());
    const projectSummary = hasProjectValue
      ? toSummary(state.project.name)
      : projectSkipped
        ? t("summary.values.notLinkedSkipped")
        : undefined;
    const hasProject = hasProjectValue || projectSkipped;

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

  useEffect(() => {
    setVisitedSteps((previous) => {
      if (previous.has(meta.currentStep)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(meta.currentStep);
      return next;
    });
  }, [meta.currentStep]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    setVisitedSteps((previous) => {
      let changed = false;
      const next = new Set(previous);

      SESSION_PLANNING_STEPS.forEach((step) => {
        const status = stepStatus[step.id];
        if (status?.hasValue && !next.has(step.id)) {
          next.add(step.id);
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [isEditing, stepStatus]);

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
  const summaryIndex = useMemo(
    () => SESSION_PLANNING_STEPS.findIndex((step) => step.id === "summary"),
    []
  );

  const handleReview = () => {
    if (summaryIndex < 0) return;
    if (meta.currentStep === "summary") return;
    goToStep(summaryIndex);
  };
  const actionLayoutClass =
    "space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:justify-end sm:gap-3";
  const renderActionButtons = () => (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3">
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
            {isCompleting ? t("wizard.confirming") : t("wizard.confirm")}
          </Button>
        )}
      </div>
      {state.meta.mode === "edit" && meta.currentStep !== "summary" ? (
        <Button
          variant="secondary"
          onClick={handleReview}
          className="w-full sm:w-auto sm:px-6"
        >
          {t("wizard.review")}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-slate-50 lg:p-0">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="relative hidden h-full flex-col overflow-hidden text-slate-100 transition-all duration-300 ease-out lg:flex lg:rounded-l-3xl">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute -inset-28 opacity-90 blur-3xl bg-[radial-gradient(900px_500px_at_20%_10%,rgba(16,185,129,0.35),transparent_65%),radial-gradient(720px_520px_at_80%_-10%,rgba(6,182,212,0.24),transparent_60%),radial-gradient(880px_680px_at_50%_95%,rgba(59,130,246,0.18),transparent_65%)]" />
            <div className="absolute -bottom-24 left-6 h-60 w-60 rounded-full bg-emerald-400/35 blur-3xl float-slow" />
            <div className="absolute top-20 right-4 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl float-slow [animation-delay:1s]" />
            <div className="absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl float-slow [animation-delay:2.4s]" />
          </div>
          <div className="absolute inset-0 bg-slate-950/80" />
          <div className="relative flex h-full flex-col gap-8 overflow-y-auto overflow-x-hidden px-6 py-10 transition-all duration-300 ease-out">
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
              visitedSteps={visitedSteps}
            />
          </div>
        </aside>

        <div className="flex flex-1 min-h-0 min-w-0 flex-col">
          <div className="border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur lg:hidden">
            <Collapsible
              open={mobileStepsOpen}
              onOpenChange={setMobileStepsOpen}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {t("stepper.progressLabel", {
                      current: currentIndex + 1,
                      total: totalSteps,
                    })}
                  </p>
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
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {currentStepLabel}
                  </h2>
                  <p className="text-sm text-slate-600">
                    {t(`steps.${meta.currentStep}.description`)}
                  </p>
                </div>
              </div>
              <Progress value={progressValue} className="mt-3" />
              <CollapsibleContent className="mt-4 space-y-3 overflow-x-hidden">
                <StepList
                  currentIndex={currentIndex}
                  onSelectStep={handleMobileSelect}
                  statuses={stepStatus}
                  translate={t}
                  variant="mobile"
                  visitedSteps={visitedSteps}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-2 py-5 sm:px-6 sm:py-10 lg:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="mx-auto w-full max-w-3xl space-y-3 sm:space-y-6 pb-10">
              <div className={actionLayoutClass}>{renderActionButtons()}</div>
              <div
                key={meta.currentStep}
                className="animate-in fade-in slide-in-from-bottom-3 rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-xl shadow-slate-900/5 backdrop-blur transition-all duration-300 ease-out sm:p-6"
              >
                {meta.currentStep === "project" ? (
                  <ProjectStep
                    onContinue={() =>
                      goToStep(
                        Math.min(
                          SESSION_PLANNING_STEPS.length - 1,
                          currentIndex + 1
                        )
                      )
                    }
                  />
                ) : (
                  <CurrentStepComponent />
                )}
              </div>
              <div className="sticky bottom-0 z-10 pb-4 pt-4">
                <div className={actionLayoutClass}>{renderActionButtons()}</div>
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
  visitedSteps: Set<SessionPlanningStepId>;
}

const StepList = ({
  currentIndex,
  onSelectStep,
  statuses,
  translate,
  variant,
  visitedSteps,
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
      const hasVisited = visitedSteps.has(step.id) || index <= currentIndex;
      const isComplete = hasValue && hasVisited && !isActive;
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
                    "border-white/15 bg-white/5 text-slate-100/80 shadow-sm transition-colors duration-200 supports-[backdrop-filter]:backdrop-blur-md before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-transparent before:opacity-0 before:transition before:duration-200 before:content-['']",
                    isActive &&
                      "border-cyan-200/80 bg-cyan-400/20 text-white shadow-xl shadow-cyan-950/20 before:bg-amber-300 before:opacity-100 before:shadow-[0_0_14px_rgba(251,191,36,0.45)]",
                    isComplete &&
                      "border-emerald-300/70 bg-emerald-400/20 text-emerald-50",
                    needsAttention &&
                      "border-amber-300/70 bg-amber-500/20 text-amber-50 shadow-lg shadow-amber-900/20"
                  )
                : cn(
                    "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:bg-slate-50",
                    isActive && "border-slate-900/20 bg-slate-900/5 shadow-md",
                    isComplete &&
                      "border-sky-400 bg-sky-500/20 text-sky-800 hover:border-sky-400/80 hover:bg-sky-500/25",
                    needsAttention &&
                      "border-rose-300 bg-rose-50 text-rose-900 hover:border-rose-400 hover:bg-rose-100"
                  )
            )}
          >
            <div className={cn("flex gap-3", alignmentClass)}>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full border text-sm font-semibold transition",
                  variant === "desktop"
                    ? cn(
                        "border-white/30 bg-white/10 text-slate-100/80",
                        isActive &&
                          "border-cyan-100 bg-cyan-400 text-slate-900 shadow",
                        isComplete &&
                          "border-emerald-200 bg-emerald-400/20 text-emerald-50",
                        needsAttention &&
                          "border-amber-200 bg-amber-500/20 text-amber-50"
                      )
                    : cn(
                        "border-slate-300 text-slate-600",
                        isActive && "border-slate-900 bg-slate-900 text-white",
                        isComplete &&
                          "border-sky-300 bg-sky-500/15 text-sky-700",
                        needsAttention &&
                          "border-rose-300 bg-rose-100 text-rose-700"
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
                        ? "text-amber-50"
                        : isActive
                          ? "text-white"
                          : isComplete
                            ? "text-emerald-50"
                            : "text-slate-100"
                      : needsAttention
                        ? "text-rose-900"
                        : isComplete
                          ? "text-sky-800"
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
                          : isActive
                            ? "text-white/90"
                            : isComplete
                              ? "text-emerald-100/80"
                              : "text-slate-100/80"
                        : needsAttention
                          ? "text-rose-800"
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
