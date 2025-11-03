import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStepStatus {
  summary?: string;
  hasValue: boolean;
}

export interface WizardStepConfig<TStepId extends string> {
  id: TStepId;
  labelKey: string;
}

export interface WizardStepListSupportingTextArgs<TStepId extends string> {
  step: WizardStepConfig<TStepId>;
  status: WizardStepStatus;
  translate: WizardStepListProps<TStepId>["translate"];
}

export interface WizardStepListProps<TStepId extends string> {
  currentIndex: number;
  onSelectStep: (index: number) => void;
  statuses: Record<TStepId, WizardStepStatus>;
  steps: WizardStepConfig<TStepId>[];
  translate: (key: string, options?: Record<string, unknown>) => string;
  variant: "desktop" | "mobile";
  visitedSteps: Set<TStepId>;
  isStepRequired?: (stepId: TStepId) => boolean;
  getSupportingText?: (
    args: WizardStepListSupportingTextArgs<TStepId>
  ) => string | undefined;
}

const DEFAULT_STATUS: WizardStepStatus = {
  summary: undefined,
  hasValue: false,
};

export function WizardStepList<TStepId extends string>({
  currentIndex,
  onSelectStep,
  statuses,
  steps,
  translate,
  variant,
  visitedSteps,
  isStepRequired,
  getSupportingText,
}: WizardStepListProps<TStepId>) {
  return (
    <ol
      className={cn(
        "flex max-w-full flex-col overflow-x-hidden",
        variant === "desktop" ? "gap-4" : "gap-3"
      )}
    >
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const status = statuses[step.id] ?? DEFAULT_STATUS;
        const summary = status.summary;
        const hasValue = status.hasValue;
        const hasVisited = visitedSteps.has(step.id) || index <= currentIndex;
        const isComplete = hasValue && hasVisited && !isActive;
        const requiresAttention = isStepRequired?.(step.id) ?? false;
        const needsAttention =
          !isActive && requiresAttention && index < currentIndex && !hasValue;

        const supportingText =
          getSupportingText?.({ step, status, translate }) ??
          (summary ?? translate(`steps.${step.id}.description`));

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
                <div className="min-w-0 flex-1">
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
}
