import { useMemo } from "react";
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
import { DetailsStep } from "../steps/DetailsStep";
import { LocationStep } from "../steps/LocationStep";
import { ScheduleStep } from "../steps/ScheduleStep";
import { NotesStep } from "../steps/NotesStep";
import { SummaryStep } from "../steps/SummaryStep";
import { useTranslation } from "react-i18next";

interface SessionPlanningWizardProps {
  onCancel: () => void;
  onComplete: () => void;
  isCompleting?: boolean;
}

const STEP_COMPONENTS: Record<SessionPlanningStepId, () => JSX.Element> = {
  lead: LeadStep,
  project: ProjectStep,
  sessionType: SessionTypeStep,
  details: DetailsStep,
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

  const goToStep = (index: number) => {
    const target = SESSION_PLANNING_STEPS[index];
    if (target) {
      setCurrentStep(target.id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pb-4">
        <StepNavigation currentIndex={currentIndex} onSelectStep={goToStep} translate={t} />
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto py-6 px-2 sm:px-0">
        <CurrentStepComponent />
      </div>
      <Separator />
      <div className="flex items-center justify-between gap-2 py-4">
        <Button variant="ghost" onClick={onCancel}>
          {t("wizard.cancel")}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => goToStep(Math.max(0, currentIndex - 1))} disabled={isFirstStep}>
            {t("wizard.back")}
          </Button>
          {!isLastStep ? (
            <Button onClick={() => goToStep(Math.min(SESSION_PLANNING_STEPS.length - 1, currentIndex + 1))}>
              {t("wizard.next")}
            </Button>
          ) : (
            <Button onClick={onComplete} disabled={isCompleting} aria-busy={isCompleting}>
              {isCompleting ? t("wizard.confirming") : t("wizard.confirm")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

interface StepNavigationProps {
  currentIndex: number;
  onSelectStep: (index: number) => void;
  translate: (key: string) => string;
}

const StepNavigation = ({ currentIndex, onSelectStep, translate }: StepNavigationProps) => (
  <nav className="flex flex-wrap gap-2">
    {SESSION_PLANNING_STEPS.map((step, index) => {
      const isActive = index === currentIndex;
      const isComplete = index < currentIndex;
      return (
        <button
          key={step.id}
          type="button"
          onClick={() => onSelectStep(index)}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
            isActive ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/20 hover:border-primary/60",
            isComplete ? "bg-muted text-muted-foreground" : null
          )}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium">
            {index + 1}
          </span>
          <span className="whitespace-nowrap">{translate(step.labelKey)}</span>
        </button>
      );
    })}
  </nav>
);
