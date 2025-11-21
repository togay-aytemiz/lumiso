import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LongPressButton } from "@/components/ui/long-press-button";

export interface OnboardingAction {
  label: string;
  onClick: () => void; // used as onConfirm when longPress is provided
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link" | "cta" | "dangerOutline";
  disabled?: boolean;
  icon?: ReactNode;
  longPress?: {
    duration?: number;
    holdingLabel?: string;
    completeLabel?: string;
  };
}

interface BaseOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  eyebrow?: ReactNode;
  headerSlot?: ReactNode;
  children?: ReactNode;
  actions: OnboardingAction[];
}

export function BaseOnboardingModal({ 
  open, 
  onClose, 
  title, 
  description, 
  eyebrow,
  headerSlot,
  children, 
  actions 
}: BaseOnboardingModalProps) {
  const hasSingleAction = actions.length === 1;
  const actionLayout = actions.length > 1 ? "grid-cols-2" : "grid-cols-1";
  const baseButtonClass = hasSingleAction ? "h-11 w-full sm:w-auto sm:min-w-[200px]" : "w-full h-11";

  return (
    <Dialog open={open} onOpenChange={() => { /* ignore external close */ }}>
      <DialogContent 
        className="w-[min(560px,calc(100%-2rem))] sm:max-w-[560px] max-h-[90vh] overflow-y-auto md:max-h-none h-auto rounded-xl md:rounded-2xl p-0 gap-0 shadow-xl border border-border/60" 
        hideClose 
        onEscapeKeyDown={(e) => { e.preventDefault(); }} 
        onPointerDownOutside={(e) => { e.preventDefault(); }}
      >
        <div className="flex flex-col gap-6 p-6 sm:p-8">
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
            <DialogDescription className="text-base leading-relaxed text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>

          {children && (
            <div className="space-y-4">
              {children}
            </div>
          )}

          <div className={hasSingleAction ? "flex justify-end pt-2" : `grid gap-3 pt-2 ${actionLayout}`}>
            {actions.map((action, index) => {
              const buttonClassName = baseButtonClass;
              return action.longPress ? (
                <LongPressButton
                  key={index}
                  onConfirm={action.onClick}
                  label={action.label}
                  duration={action.longPress.duration}
                  holdingLabel={action.longPress.holdingLabel}
                  completeLabel={action.longPress.completeLabel}
                  variant={action.variant || (index === actions.length - 1 ? "default" : "outline")}
                  disabled={action.disabled}
                  className={buttonClassName}
                />
              ) : (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant={action.variant || (index === actions.length - 1 ? "default" : "outline")}
                  disabled={action.disabled}
                  className={buttonClassName}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </Button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
