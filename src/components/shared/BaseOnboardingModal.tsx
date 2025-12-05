import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LongPressButton } from "@/components/ui/long-press-button";
import { Tooltip, TooltipContent, TooltipContentDark, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface OnboardingAction {
  label: string;
  onClick: () => void; // used as onConfirm when longPress is provided
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link" | "cta" | "dangerOutline";
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  longPress?: {
    duration?: number;
    holdingLabel?: string;
    completeLabel?: string;
  };
  tooltip?: {
    content: ReactNode;
    variant?: "dark" | "light";
  };
}

interface BaseOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  headerSlot?: ReactNode;
  children?: ReactNode;
  actions: OnboardingAction[];
  contentClassName?: string;
  size?: "default" | "wide";
}

export function BaseOnboardingModal({ 
  open, 
  onClose, 
  title, 
  description, 
  eyebrow,
  headerSlot,
  children, 
  actions,
  contentClassName,
  size = "default"
}: BaseOnboardingModalProps) {
  const hasSingleAction = actions.length === 1;
  const isMobile = useIsMobile();
  const actionLayout = actions.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";
  const baseButtonClass = hasSingleAction
    ? "h-11 w-full sm:w-auto sm:min-w-[200px]"
    : isMobile
      ? "h-11 w-full flex-1"
      : "w-full h-11";
  const actionContainerClass = hasSingleAction
    ? "flex flex-col sm:flex-row sm:justify-end gap-3 pt-2"
    : isMobile
      ? "flex flex-col gap-3 pt-2"
      : `grid gap-3 pt-2 ${actionLayout}`;

  return (
    <Dialog open={open} onOpenChange={() => { /* ignore external close */ }}>
      <DialogContent 
        className={cn(
          "max-h-[90vh] overflow-y-auto md:max-h-none h-auto rounded-xl md:rounded-2xl p-0 gap-0 shadow-xl border border-border/60",
          size === "wide"
            ? "w-[min(640px,calc(100%-2rem))] sm:max-w-[1100px] lg:w-[min(96vw,1240px)] lg:max-w-[1240px]"
            : "w-[min(540px,calc(100%-2rem))] sm:max-w-[720px] lg:w-[min(84vw,820px)] lg:max-w-3xl"
        )} 
        hideClose 
        onEscapeKeyDown={(e) => { e.preventDefault(); }} 
        onPointerDownOutside={(e) => { e.preventDefault(); }}
      >
        <div className={cn("flex flex-col p-6 sm:p-8", contentClassName ?? "gap-6")}>
          <DialogHeader className="space-y-2 text-left">
            {eyebrow && (
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </div>
            )}
            {headerSlot && (
              <div className="mt-1">{headerSlot}</div>
            )}
            <DialogTitle className="text-2xl font-semibold leading-tight">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="text-base leading-relaxed text-muted-foreground">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>

          {children && (
            <div className="space-y-4">
              {children}
            </div>
          )}

          <div className={actionContainerClass}>
            {actions.map((action, index) => {
              const buttonClassName = [
                baseButtonClass,
                "whitespace-normal text-center leading-snug",
                action.className
              ]
                .filter(Boolean)
                .join(" ");
              const variant = action.variant || (index === actions.length - 1 ? "default" : "outline");
              const button = action.longPress ? (
                <LongPressButton
                  onConfirm={action.onClick}
                  label={action.label}
                  duration={action.longPress.duration}
                  holdingLabel={action.longPress.holdingLabel}
                  completeLabel={action.longPress.completeLabel}
                  variant={variant}
                  disabled={action.disabled}
                  className={buttonClassName}
                />
              ) : (
                <Button
                  onClick={action.onClick}
                  variant={variant}
                  disabled={action.disabled}
                  className={buttonClassName}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </Button>
              );

              if (action.tooltip) {
                const ContentComponent = action.tooltip.variant === "dark" ? TooltipContentDark : TooltipContent;
                return (
                  <TooltipProvider key={index}>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex w-full" tabIndex={action.disabled ? 0 : -1}>
                          {button}
                        </span>
                      </TooltipTrigger>
                      <ContentComponent side="top">
                        {action.tooltip.content}
                      </ContentComponent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }

              return (
                <span key={index} className="inline-flex w-full">
                  {button}
                </span>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
