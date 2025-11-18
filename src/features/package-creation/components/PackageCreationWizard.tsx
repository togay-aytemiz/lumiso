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
import {
  PACKAGE_CREATION_STEPS,
  PackageCreationStepConfig,
} from "../state/packageCreationReducer";
import { PackageCreationLineItem, PackageCreationStepId, PackageVatMode } from "../types";
import { usePackageCreationContext } from "../hooks/usePackageCreationContext";
import { usePackageCreationActions } from "../hooks/usePackageCreationActions";
import {
  BasicsStep,
  DeliveryStep,
  PricingStep,
  ServicesStep,
  SummaryStep,
} from "../steps";
import { calculateLineItemPricing } from "../utils/lineItemPricing";
import {
  WizardStepList,
  type WizardStepListSupportingTextArgs,
} from "@/features/wizard/components/WizardStepList";
import { cn } from "@/lib/utils";

const STEP_COMPONENTS: Record<PackageCreationStepId, () => JSX.Element> = {
  basics: BasicsStep,
  services: ServicesStep,
  delivery: DeliveryStep,
  pricing: PricingStep,
  summary: SummaryStep,
};

const REQUIRED_STEPS: Record<PackageCreationStepId, boolean> = {
  basics: true,
  services: false,
  delivery: false,
  pricing: false,
  summary: false,
};

interface PackageCreationWizardProps {
  onComplete: () => void;
  isCompleting?: boolean;
}

export const PackageCreationWizard = ({
  onComplete,
  isCompleting,
}: PackageCreationWizardProps) => {
  const { state } = usePackageCreationContext();
  const { setCurrentStep } = usePackageCreationActions();
  const { t } = useTranslation("packageCreation");
  const isEditing = state.meta.mode === "edit";

  const [visitedSteps, setVisitedSteps] = useState<Set<PackageCreationStepId>>(
    () => new Set()
  );
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const viewedStepRef = useRef<PackageCreationStepId | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const rawIndex = useMemo(
    () =>
      PACKAGE_CREATION_STEPS.findIndex(
        (step) => step.id === state.meta.currentStep
      ),
    [state.meta.currentStep]
  );
  const currentIndex = rawIndex < 0 ? 0 : rawIndex;
  const totalSteps = PACKAGE_CREATION_STEPS.length;
  const isFirstStep = currentIndex <= 0;
  const isLastStep = currentIndex >= totalSteps - 1;
  const progressValue =
    totalSteps === 0 ? 0 : Math.round(((currentIndex + 1) / totalSteps) * 100);

  const CurrentStepComponent =
    STEP_COMPONENTS[state.meta.currentStep] ?? BasicsStep;

  const basePriceInput = parseWizardAmount(state.pricing.basePrice);
  const packageVatRate =
    typeof state.pricing.packageVatRate === "number" && Number.isFinite(state.pricing.packageVatRate)
      ? state.pricing.packageVatRate
      : 0;
  const packageVatMode: PackageVatMode =
    state.pricing.packageVatMode === "inclusive" || state.pricing.packageVatMode === "exclusive"
      ? state.pricing.packageVatMode
      : "inclusive";
  const basePricePricing = calculateLineItemPricing({
    id: "package-base-price",
    type: "custom",
    name: "Package price",
    quantity: 1,
    unitPrice: basePriceInput,
    vatRate: packageVatRate,
    vatMode: packageVatMode,
  } as PackageCreationLineItem);
  const basePriceGross = Math.round(basePricePricing.gross * 100) / 100;

  const stepStatus = useMemo<
    Record<PackageCreationStepId, { summary?: string; hasValue: boolean }>
  >(() => {
    const serviceCount = state.services.items.length;
    const photoSummary = state.delivery.estimateType === "range"
      ? state.delivery.countMin && state.delivery.countMax
        ? `${state.delivery.countMin}-${state.delivery.countMax} ${t("steps.delivery.summary.photosSuffix")}`
        : undefined
      : state.delivery.countMin
      ? `${state.delivery.countMin} ${t("steps.delivery.summary.photosSuffix")}`
      : undefined;

    const leadSummary = state.delivery.leadTimeValue
      ? `${state.delivery.leadTimeValue} ${t(`steps.delivery.leadTime.${state.delivery.leadTimeUnit ?? "days"}`)}`
      : undefined;

    const methodsSummary = state.delivery.methods.length
      ? t("steps.delivery.summary.methods")
      : undefined;

    const deliveryHasValue = Boolean(
      photoSummary || leadSummary || methodsSummary
    );

    const pricingSummaryParts: string[] = [];
    if (basePriceGross > 0) {
      pricingSummaryParts.push(formatWizardCurrency(basePriceGross));
    }
    if (state.pricing.depositMode === "fixed" && state.pricing.depositValue) {
      pricingSummaryParts.push(
        `${t("summaryView.pricing.deposit.label")}: ${formatWizardCurrency(parseWizardAmount(state.pricing.depositValue))}`
      );
    } else if (state.pricing.depositValue) {
      pricingSummaryParts.push(
        `${t("summaryView.pricing.deposit.label")}: ${sanitizePercent(state.pricing.depositValue)}% ${state.pricing.depositMode === "percent_base"
          ? t("steps.pricing.deposit.percentTarget.base")
          : t("steps.pricing.deposit.percentTarget.subtotal")}`
      );
    }
    const pricingSummary = pricingSummaryParts.length ? pricingSummaryParts.join(" • ") : undefined;

      return {
        basics: {
          summary: state.basics.name?.trim(),
          hasValue: Boolean(state.basics.name?.trim()),
        },
        services: {
          summary:
            serviceCount > 0
              ? t("steps.services.summary.selectedCount", {
                  count: serviceCount,
                  defaultValue:
                    serviceCount === 1
                      ? "1 service selected"
                      : `${serviceCount} services selected`,
                })
              : undefined,
          hasValue: serviceCount > 0,
        },
        delivery: {
          summary: methodsSummary || leadSummary || photoSummary,
          hasValue: deliveryHasValue,
        },
      pricing: {
        summary: pricingSummary,
        hasValue: basePriceGross > 0,
      },
      summary: {
        summary: undefined,
        hasValue: false,
      },
    };
  }, [
    basePriceGross,
    state.basics.name,
    state.delivery.countMax,
    state.delivery.countMin,
    state.delivery.estimateType,
    state.delivery.leadTimeUnit,
    state.delivery.leadTimeValue,
    state.delivery.methods.length,
    state.pricing.depositMode,
    state.pricing.depositValue,
    state.services.items.length,
    t,
  ]);

  useEffect(() => {
    setVisitedSteps((previous) => {
      if (previous.has(state.meta.currentStep)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(state.meta.currentStep);
      return next;
    });
  }, [state.meta.currentStep]);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    if (
      !state.meta.isDirty &&
      state.meta.currentStep === PACKAGE_CREATION_STEPS[0]?.id
    ) {
      setVisitedSteps(new Set([PACKAGE_CREATION_STEPS[0].id]));
    }
  }, [state.meta.currentStep, state.meta.isDirty, isEditing]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    setVisitedSteps((previous) => {
      let changed = false;
      const next = new Set(previous);

      PACKAGE_CREATION_STEPS.forEach((step) => {
        const status = stepStatus[step.id];
        if (status?.hasValue && !next.has(step.id)) {
          next.add(step.id);
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [isEditing, stepStatus]);

  useEffect(() => {
    viewedStepRef.current = state.meta.currentStep;
  }, [state.meta.currentStep]);

  const getSupportingText = useCallback(
    ({
      step,
      status,
    }: WizardStepListSupportingTextArgs<PackageCreationStepId>) => {
      const safeTranslate = (key: string) => {
        const result = t(key, { defaultValue: "" });
        return result === "" ? undefined : result;
      };
      if (step.id === "summary") {
        return undefined;
      }
      const hint = safeTranslate(`steps.${step.id}.navigationLabel.hint`);
      const description = safeTranslate(`steps.${step.id}.description`);

      if (step.id === "delivery") {
        return hint ?? description ?? status.summary;
      }
      return status.summary ?? hint ?? description;
    },
    [t]
  );

  const goToStep = (index: number) => {
    const target = PACKAGE_CREATION_STEPS[index];
    if (!target) return;
    setCurrentStep(target.id);
  };

  const handleMobileSelect = (index: number) => {
    goToStep(index);
    setMobileStepsOpen(false);
  };

  const handleNextStep = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    goToStep(Math.min(totalSteps - 1, currentIndex + 1));
  };

  const handlePreviousStep = () => {
    if (isFirstStep) return;
    goToStep(Math.max(0, currentIndex - 1));
  };

  const handleReview = () => {
    const summaryIndex = PACKAGE_CREATION_STEPS.findIndex(
      (step) => step.id === "summary"
    );
    if (summaryIndex < 0) return;
    if (state.meta.currentStep === "summary") return;
    goToStep(summaryIndex);
  };
  const actionLayoutClass =
    "space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:justify-end sm:gap-3";
  const renderActionButtons = () => (
    <>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3">
        <Button
          variant="outline"
          onClick={handlePreviousStep}
          disabled={isFirstStep}
          className="w-full sm:w-auto sm:px-6"
        >
          {t("actions.previous", "Previous")}
        </Button>
        {!isLastStep ? (
          <Button onClick={handleNextStep} className="w-full sm:w-auto sm:px-8">
            {t("actions.next", "Next")}
          </Button>
        ) : (
          <Button
            onClick={handleNextStep}
            disabled={isCompleting}
            aria-busy={isCompleting}
            className="w-full sm:w-auto sm:px-8"
          >
            {isCompleting
              ? t("actions.finishing", "Finishing…")
              : t("actions.finish", "Finish")}
          </Button>
        )}
      </div>
      {isEditing && state.meta.currentStep !== "summary" ? (
        <Button
          variant="secondary"
          onClick={handleReview}
          className="w-full sm:w-auto sm:px-6"
        >
          {t("actions.reviewSummary", "Review summary")}
        </Button>
      ) : null}
    </>
  );

  const currentStepConfig = PACKAGE_CREATION_STEPS[currentIndex];
  const currentStepLabel =
    (currentStepConfig && t(currentStepConfig.labelKey)) ||
    t("stepper.unknownStep", "Step");

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
              steps={PACKAGE_CREATION_STEPS}
              translate={t}
              variant="desktop"
              visitedSteps={visitedSteps}
              isStepRequired={(stepId) => REQUIRED_STEPS[stepId] ?? false}
              getSupportingText={getSupportingText}
            />
          </div>
        </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur lg:hidden">
              <Collapsible open={mobileStepsOpen} onOpenChange={setMobileStepsOpen}>
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
                          ? t("stepper.hideSteps", "Hide steps")
                          : t("stepper.showSteps", "Show steps")}
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
                    {t(`steps.${state.meta.currentStep}.description`)}
                  </p>
                </div>
              </div>
              <Progress value={progressValue} className="mt-3" />
              <CollapsibleContent className="mt-4 space-y-3 overflow-x-hidden">
                <WizardStepList
                  currentIndex={currentIndex}
                  onSelectStep={handleMobileSelect}
                  statuses={stepStatus}
                  steps={PACKAGE_CREATION_STEPS}
                  translate={t}
                  variant="mobile"
                  visitedSteps={visitedSteps}
                  isStepRequired={(stepId) => REQUIRED_STEPS[stepId] ?? false}
                  getSupportingText={getSupportingText}
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
                key={state.meta.currentStep}
                className="animate-in fade-in slide-in-from-bottom-3 rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-xl shadow-slate-900/5 backdrop-blur transition-all duration-300 ease-out sm:p-6"
              >
                <CurrentStepComponent />
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

function parseWizardAmount(value: string | number | null | undefined) {
  if (!value) return 0;
  const numeric = typeof value === "string"
    ? parseFloat(value.replace(/[^0-9.,-]/g, "").replace(",", "."))
    : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function formatWizardCurrency(amount: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);
}

function sanitizePercent(value: string) {
  return value.replace(/[^0-9.,]/g, "");
}
