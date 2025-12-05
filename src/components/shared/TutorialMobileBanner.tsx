import { Button } from "@/components/ui/button";
import { LongPressButton } from "@/components/ui/long-press-button";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

type TutorialMobileBannerProps = {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: string;
  canProceed: boolean;
  requiresAction?: boolean;
  disabledTooltip?: string;
  onNext: () => void;
  onExit: () => void;
};

/**
 * Compact, mobile-only banner for tutorial steps.
 * Lives at the bottom of the viewport and keeps copy to two short lines.
 */
export function TutorialMobileBanner({
  stepNumber,
  totalSteps,
  title,
  description,
  canProceed,
  requiresAction,
  disabledTooltip,
  onNext,
  onExit,
}: TutorialMobileBannerProps) {
  const { t } = useTranslation("pages");
  const isBlocked = requiresAction && !canProceed;

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[40] px-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-2">
      <div className="w-full rounded-2xl border border-white/12 bg-slate-900/95 text-white shadow-[0_16px_46px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-col gap-2 px-3.5 py-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-semibold leading-snug">
              {title}
            </p>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-white/60">
              {t("onboarding.tutorial.step_of", {
                current: stepNumber,
                total: totalSteps,
              })}
            </span>
          </div>

          <p className="text-xs leading-snug text-white/80 line-clamp-2">
            {description}
          </p>

          {isBlocked && disabledTooltip && (
            <p className="text-[11px] leading-tight text-amber-100/90">
              {disabledTooltip}
            </p>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            <LongPressButton
              onConfirm={onExit}
              label={t("onboarding.tutorial.exit_tutorial")}
              holdingLabel={t("onboarding.tutorial.hold_to_exit")}
              completeLabel={t("onboarding.tutorial.exiting")}
              duration={2200}
              className="flex-1 h-11 border border-white/25 bg-white/15 text-white font-semibold hover:bg-white/25"
            />
            <Button
              onClick={onNext}
              disabled={isBlocked}
              className="flex-1 h-11 bg-white text-slate-900 hover:bg-white/90"
            >
              {stepNumber === totalSteps
                ? t("onboarding.tutorial.complete")
                : t("onboarding.tutorial.next")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
