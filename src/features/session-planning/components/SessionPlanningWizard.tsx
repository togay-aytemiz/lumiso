import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { SessionPlanningSummarySidebar } from "./SessionPlanningSummarySidebar";
import { Check, PanelRightOpen, Calendar, MapPin, Briefcase, User, Tag } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";

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
  summary: SummaryStep
};

export const SessionPlanningWizard = ({ onCancel, onComplete, isCompleting }: SessionPlanningWizardProps) => {
  const {
    state: { meta }
  } = useSessionPlanningContext();
  const { setCurrentStep } = useSessionPlanningActions();
  const { t } = useTranslation("sessionPlanning");

  const currentIndex = useMemo(
    () => SESSION_PLANNING_STEPS.findIndex((step) => step.id === meta.currentStep),
    [meta.currentStep]
  );

  const CurrentStepComponent = useMemo(() => STEP_COMPONENTS[meta.currentStep], [meta.currentStep]);
  const isFirstStep = currentIndex <= 0;
  const isLastStep = currentIndex === SESSION_PLANNING_STEPS.length - 1;
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [focusedSummaryStep, setFocusedSummaryStep] = useState<SessionPlanningStepId | undefined>(undefined);
  const { state } = useSessionPlanningContext();
  const handleEditStep = (step: SessionPlanningStepId) => {
    setFocusedSummaryStep(step);
    setSummaryOpen(false);
    setCurrentStep(step);
  };

  const goToStep = (index: number) => {
    const target = SESSION_PLANNING_STEPS[index];
    if (target) {
      setCurrentStep(target.id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 pb-4">
        <StepNavigation currentIndex={currentIndex} onSelectStep={goToStep} translate={t} />
        <SummaryHighlights
          onReview={() => {
            setFocusedSummaryStep(undefined);
            setSummaryOpen(true);
          }}
          onSelectStep={(step) => {
            setFocusedSummaryStep(step);
            setSummaryOpen(true);
          }}
        />
        <SummaryMiniCards />
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto py-6">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <CurrentStepComponent />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <Button variant="ghost" onClick={onCancel} className="lg:px-6">
          {t("wizard.cancel")}
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            variant="outline"
            onClick={() => goToStep(Math.max(0, currentIndex - 1))}
            disabled={isFirstStep}
            className="sm:px-6"
          >
            {t("wizard.back")}
          </Button>
          {!isLastStep ? (
            <Button
              onClick={() => goToStep(Math.min(SESSION_PLANNING_STEPS.length - 1, currentIndex + 1))}
              className="sm:px-8"
            >
              {t("wizard.next")}
            </Button>
          ) : (
            <Button onClick={onComplete} disabled={isCompleting} aria-busy={isCompleting} className="sm:px-8">
              {isCompleting ? t("wizard.confirming") : t("wizard.confirm")}
            </Button>
          )}
        </div>
      </div>

      <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t("summaryPanel.title")}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <SessionPlanningSummarySidebar onEditStep={handleEditStep} focusedStep={focusedSummaryStep} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

interface StepNavigationProps {
  currentIndex: number;
  onSelectStep: (index: number) => void;
  translate: (key: string) => string;
}

const StepNavigation = ({ currentIndex, onSelectStep, translate }: StepNavigationProps) => (
  <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
    {SESSION_PLANNING_STEPS.map((step, index) => {
      const isActive = index === currentIndex;
      const isComplete = index < currentIndex;
      return (
        <li key={step.id}>
          <button
            type="button"
            onClick={() => onSelectStep(index)}
            className={cn(
              "group flex w-full flex-col items-start rounded-xl border bg-card/70 px-4 py-3 text-left shadow-sm transition-all",
              isActive
                ? "border-primary/60 bg-primary/10 shadow-primary/10"
                : "border-border/70 hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            <span
              className={cn(
                "mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : isComplete
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
              )}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {translate(step.labelKey)}
            </span>
          </button>
        </li>
      );
    })}
  </ol>
);

interface SummaryHighlightsProps {
  onReview: () => void;
  onSelectStep: (step: SessionPlanningStepId) => void;
}

const SummaryHighlights = ({ onReview, onSelectStep }: SummaryHighlightsProps) => {
  const { state } = useSessionPlanningContext();
  const { t } = useTranslation("sessionPlanning");

  const scheduleLabel = state.schedule.date
    ? `${state.schedule.date}${state.schedule.time ? ` • ${state.schedule.time}` : ""}`
    : t("summary.values.notScheduled");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm shadow-sm">
      <Highlight icon={User} label={state.lead.name || t("summary.values.notSet")} onClick={() => onSelectStep("lead")} />
      <Highlight icon={Briefcase} label={state.project.name || t("summary.values.notLinked")} onClick={() => onSelectStep("project")} />
      <Highlight icon={Tag} label={state.sessionTypeLabel || t("summary.values.notSet")} onClick={() => onSelectStep("sessionType")} />
      <Highlight icon={Calendar} label={scheduleLabel} onClick={() => onSelectStep("schedule")} />
      <Highlight icon={MapPin} label={state.location || t("summary.values.notSet")} onClick={() => onSelectStep("location")} />
      <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={onReview}>
        <PanelRightOpen className="mr-2 h-3.5 w-3.5" />
        {t("summaryPanel.reviewButton")}
      </Button>
    </div>
  );
};

interface HighlightProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}

const Highlight = ({ icon: Icon, label, onClick }: HighlightProps) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 transition hover:border-primary/40 hover:bg-primary/5"
  >
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon className="h-3.5 w-3.5" />
    </span>
    <span className="max-w-[140px] truncate font-medium text-foreground">{label}</span>
  </button>
);

const SummaryMiniCards = () => {
  const { state } = useSessionPlanningContext();
  const { t } = useTranslation("sessionPlanning");

  const items = [
    {
      title: t("summary.labels.lead"),
      value: state.lead.name
    },
    {
      title: t("summary.labels.project"),
      value: state.project.name
    },
    {
      title: t("summary.labels.sessionType"),
      value: state.sessionTypeLabel
    },
    {
      title: t("summary.labels.location"),
      value: state.location
    }
  ].filter((item) => Boolean(item.value));

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Card key={item.title} className="border border-border/70 bg-muted/30 px-4 py-3 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.title}</p>
          <p className="mt-1 font-medium text-foreground">{item.value}</p>
        </Card>
      ))}
    </div>
  );
};
