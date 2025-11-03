import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { trackEvent } from "@/lib/telemetry";
import {
  PROJECT_CREATION_STEPS,
  ProjectCreationStepConfig,
} from "../state/projectCreationReducer";
import { useProjectCreationActions } from "../hooks/useProjectCreationActions";
import { useProjectCreationContext } from "../hooks/useProjectCreationContext";
import { ProjectCreationStepId } from "../types";
import { LeadStep } from "../steps/LeadStep";
import { DetailsStep } from "../steps/DetailsStep";
import { PackagesStep } from "../steps/PackagesStep";
import { SummaryStep } from "../steps/SummaryStep";
import {
  WizardStepList,
  type WizardStepListSupportingTextArgs,
} from "@/features/wizard/components/WizardStepList";

const STEP_COMPONENTS: Record<ProjectCreationStepId, () => JSX.Element> = {
  lead: LeadStep,
  details: DetailsStep,
  packages: PackagesStep,
  summary: SummaryStep,
};

interface ProjectCreationWizardProps {
  onComplete: () => void;
  isCompleting?: boolean;
}

export const ProjectCreationWizard = ({
  onComplete,
  isCompleting,
}: ProjectCreationWizardProps) => {
  const { state } = useProjectCreationContext();
  const { meta } = state;
  const { setCurrentStep } = useProjectCreationActions();
  const { t } = useTranslation("projectCreation");
  const { toast } = useToast();

  const [visitedSteps, setVisitedSteps] = useState<Set<ProjectCreationStepId>>(
    () => new Set()
  );
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const viewedStepRef = useRef<ProjectCreationStepId | null>(null);

  const rawIndex = useMemo(
    () =>
      PROJECT_CREATION_STEPS.findIndex((step) => step.id === meta.currentStep),
    [meta.currentStep]
  );
  const currentIndex = rawIndex < 0 ? 0 : rawIndex;
  const totalSteps = PROJECT_CREATION_STEPS.length;
  const isFirstStep = currentIndex <= 0;
  const isLastStep = currentIndex >= totalSteps - 1;
  const progressValue =
    totalSteps === 0 ? 0 : Math.round(((currentIndex + 1) / totalSteps) * 100);

  const CurrentStepComponent = useMemo(
    () => STEP_COMPONENTS[meta.currentStep],
    [meta.currentStep]
  );

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
    if (
      !state.meta.isDirty &&
      meta.currentStep === PROJECT_CREATION_STEPS[0]?.id
    ) {
      setVisitedSteps(new Set([PROJECT_CREATION_STEPS[0].id]));
    }
  }, [meta.currentStep, state.meta.isDirty]);

  useEffect(() => {
    if (viewedStepRef.current === meta.currentStep) return;
    viewedStepRef.current = meta.currentStep;
    trackEvent("project_wizard_step_viewed", {
      stepId: meta.currentStep,
      entrySource: state.meta.entrySource ?? "direct",
    });
  }, [meta.currentStep, state.meta.entrySource]);

  const getSupportingText = useCallback(
    ({
      step,
      status,
      translate,
    }: WizardStepListSupportingTextArgs<ProjectCreationStepId>) => {
      if (step.id === "summary") {
        return undefined;
      }
      return status.summary ?? translate(`steps.${step.id}.description`);
    },
    []
  );

  const stepStatus = useMemo(() => {
    const leadSummary = state.lead.name?.trim();
    const hasLead = Boolean(state.lead.id || leadSummary);

    const projectName = state.details.name?.trim();
    const projectTypeLabel = state.details.projectTypeLabel?.trim();
    const hasDetails = Boolean(projectName && state.details.projectTypeId);
    const detailsSummary = projectName ?? projectTypeLabel;

    const lineItemCount = state.services.items.length;

    const packageSummary = state.services.packageLabel
      ? state.services.packageLabel
      : state.services.packageId
      ? t("summary.values.packageSelected")
      : lineItemCount > 0
      ? t("summary.values.servicesSelected", {
          count: lineItemCount,
        })
      : undefined;
    const hasPackages =
      Boolean(state.services.packageId) || lineItemCount > 0;

    const summaryNotes = state.details.description?.trim();

    return {
      lead: { summary: leadSummary, hasValue: hasLead },
      details: { summary: detailsSummary, hasValue: hasDetails },
      packages: { summary: packageSummary, hasValue: hasPackages },
      summary: {
        summary: summaryNotes,
        hasValue: Boolean(summaryNotes),
      },
    } satisfies Record<
      ProjectCreationStepId,
      { summary?: string; hasValue: boolean }
    >;
  }, [state.details, state.lead, state.services, t]);

  const goToStep = (index: number) => {
    const target = PROJECT_CREATION_STEPS[index];
    if (!target) return;
    if (index > currentIndex) {
      const currentStep = PROJECT_CREATION_STEPS[currentIndex];
      trackEvent("project_wizard_step_completed", {
        stepId: currentStep.id,
        entrySource: state.meta.entrySource ?? "direct",
      });
    } else if (index < currentIndex) {
      trackEvent("project_wizard_step_revisited", {
        stepId: target.id,
        fromStep: PROJECT_CREATION_STEPS[currentIndex].id,
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
    const nextIndex = Math.min(totalSteps - 1, currentIndex + 1);
    if (nextIndex === currentIndex) return;

    const validationKey = validateStep(
      PROJECT_CREATION_STEPS[currentIndex],
      stepStatus
    );
    if (validationKey) {
      toast({
        title: t(validationKey.title),
        description: t(validationKey.description),
        variant: "destructive",
      });
      return;
    }

    goToStep(nextIndex);
  };

  const currentStepConfig = PROJECT_CREATION_STEPS[currentIndex];
  const currentStepLabel =
    (currentStepConfig && t(currentStepConfig.labelKey)) ||
    t("stepper.unknownStep");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-slate-50">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="relative hidden h-full w-full flex-col text-slate-100 transition-all duration-300 ease-out lg:flex lg:rounded-l-3xl">
          <div
            className="pointer-events-none absolute inset-0 rounded-l-3xl overflow-hidden"
            aria-hidden="true"
          >
            <div className="absolute -inset-28 opacity-90 blur-3xl bg-[radial-gradient(900px_500px_at_20%_10%,rgba(16,185,129,0.35),transparent_65%),radial-gradient(720px_520px_at_80%_-10%,rgba(6,182,212,0.24),transparent_60%),radial-gradient(880px_680px_at_50%_95%,rgba(59,130,246,0.18),transparent_65%)]" />
            <div className="absolute -bottom-24 left-6 h-60 w-60 rounded-full bg-emerald-400/35 blur-3xl float-slow" />
            <div className="absolute top-20 right-4 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl float-slow [animation-delay:1s]" />
            <div className="absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl float-slow [animation-delay:2.4s]" />
          </div>
          <div className="absolute inset-0 rounded-l-3xl bg-slate-950/80" />
          <div className="relative flex h-full min-h-[640px] flex-col gap-8 overflow-y-auto overflow-x-hidden px-6 py-10 transition-all duration-300 ease-out">
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
            <WizardStepList
              currentIndex={currentIndex}
              onSelectStep={goToStep}
              statuses={stepStatus}
              steps={PROJECT_CREATION_STEPS}
              translate={t}
              variant="desktop"
              visitedSteps={visitedSteps}
              isStepRequired={(stepId) => REQUIRED_STEPS[stepId] ?? false}
              getSupportingText={getSupportingText}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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
                <WizardStepList
                  currentIndex={currentIndex}
                  onSelectStep={handleMobileSelect}
                  statuses={stepStatus}
                  steps={PROJECT_CREATION_STEPS}
                  translate={t}
                  variant="mobile"
                  visitedSteps={visitedSteps}
                  isStepRequired={(stepId) => REQUIRED_STEPS[stepId] ?? false}
                  getSupportingText={getSupportingText}
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
                      ? t("wizard.creating")
                      : t("wizard.createProject")}
                  </Button>
                )}
              </div>
              <div
                key={meta.currentStep}
                className="animate-in fade-in slide-in-from-bottom-3 rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-xl shadow-slate-900/5 backdrop-blur overflow-visible transition-all duration-300 ease-out"
              >
                <CurrentStepComponent />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const REQUIRED_STEPS: Record<ProjectCreationStepId, boolean> = {
  lead: true,
  details: true,
  packages: false,
  summary: false,
};

const validateStep = (
  stepConfig: ProjectCreationStepConfig,
  statuses: Record<
    ProjectCreationStepId,
    { summary?: string; hasValue: boolean }
  >
) => {
  const stepId = stepConfig.id;
  if (!REQUIRED_STEPS[stepId]) {
    return null;
  }

  if (statuses[stepId]?.hasValue) {
    return null;
  }

  return {
    title: `validation.${stepId}.title`,
    description: `validation.${stepId}.description`,
  };
};
