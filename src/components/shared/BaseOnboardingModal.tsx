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
  children?: ReactNode;
  actions: OnboardingAction[];
}

export function BaseOnboardingModal({ 
  open, 
  onClose, 
  title, 
  description, 
  children, 
  actions 
}: BaseOnboardingModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => { /* ignore external close */ }}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto md:max-h-none md:h-auto h-full md:rounded-lg rounded-none" 
        hideClose 
        onEscapeKeyDown={(e) => { e.preventDefault(); }} 
        onPointerDownOutside={(e) => { e.preventDefault(); }}
      >
        <DialogHeader className="text-center space-y-4">
          <DialogTitle className="text-2xl font-bold text-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {children && (
          <div className="my-6">
            {children}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-6 pb-8">
          {actions.map((action, index) => (
            action.longPress ? (
              <LongPressButton
                key={index}
                onConfirm={action.onClick}
                label={action.label}
                duration={action.longPress.duration}
                holdingLabel={action.longPress.holdingLabel}
                completeLabel={action.longPress.completeLabel}
                variant={action.variant || (index === actions.length - 1 ? "default" : "outline")}
                disabled={action.disabled}
                className="w-full h-11"
              />
            ) : (
              <Button
                key={index}
                onClick={action.onClick}
                variant={action.variant || (index === actions.length - 1 ? "default" : "outline")}
                disabled={action.disabled}
                className="w-full h-11"
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </Button>
            )
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}