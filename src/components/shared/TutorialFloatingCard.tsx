import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContentDark, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LongPressButton } from "@/components/ui/long-press-button";
import { useTranslation } from "react-i18next";

interface TutorialFloatingCardProps {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description: ReactNode;
  content?: ReactNode;
  canProceed: boolean;
  requiresAction?: boolean;
  disabledTooltip?: string;
  onNext: () => void;
  onExit: () => void;
  position?: "top-right" | "bottom-right" | "top-left" | "bottom-left" | "center";
}

export function TutorialFloatingCard({
  stepNumber,
  totalSteps,
  title,
  description,
  content,
  canProceed,
  requiresAction,
  disabledTooltip,
  onNext,
  onExit,
  position = "top-right"
}: TutorialFloatingCardProps) {
  const { t } = useTranslation('pages');

  const getPositionClasses = () => {
    switch (position) {
      case "top-right":
        return "fixed top-4 right-4 z-50";
      case "bottom-right":
        return "fixed bottom-4 right-4 z-50";
      case "top-left":
        return "fixed top-4 left-4 z-50";
      case "bottom-left":
        return "fixed bottom-4 left-4 z-50";
      case "center":
        return "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50";
      default:
        return "fixed top-4 right-4 z-50";
    }
  };

  const isLastStep = stepNumber === totalSteps;

  return (
    <div className={getPositionClasses()}>
      <Card className="w-80 max-w-[90vw] shadow-[0_18px_60px_rgba(0,0,0,0.45)] border-white/10 bg-slate-900/95 text-white backdrop-blur">
        <CardHeader className="pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
              {t('onboarding.tutorial.step_of', { current: stepNumber, total: totalSteps })}
            </div>
          </div>
          <CardTitle className="text-lg text-white leading-tight">{title}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <p className="text-sm text-white/80 leading-relaxed">
            {description}
          </p>

          {content && (
            <div className="text-sm text-white/90 [&_.text-muted-foreground]:text-white/75 [&_.text-foreground]:text-white [&_.text-card-foreground]:text-white [&_.text-secondary-foreground]:text-white/80">
              {content}
            </div>
          )}

          {requiresAction && !canProceed && disabledTooltip && (
            <p className="text-xs font-semibold text-amber-200/90 leading-snug bg-amber-500/15 border border-amber-300/40 rounded-md px-3 py-2">
              {disabledTooltip}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <LongPressButton
              variant="dangerOutline"
              onConfirm={onExit}
              label={t('onboarding.tutorial.exit_tutorial')}
              duration={3000}
              holdingLabel={t('onboarding.tutorial.hold_to_exit')}
              completeLabel={t('onboarding.tutorial.exiting')}
              className="flex-1 border border-white/25 bg-white/15 text-white font-semibold hover:bg-white/25"
            />

            {requiresAction && !canProceed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1">
                      <Button disabled className="pointer-events-none w-full bg-white text-slate-900 hover:bg-white/90">
                        {isLastStep ? t('onboarding.tutorial.complete') : t('onboarding.tutorial.next')}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContentDark side="top" align="center" collisionPadding={12} className="max-w-xs text-center">
                    <p>{disabledTooltip}</p>
                  </TooltipContentDark>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button onClick={onNext} className="flex-1 bg-white text-slate-900 hover:bg-white/90">
                {isLastStep ? t('onboarding.tutorial.complete') : t('onboarding.tutorial.next')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
