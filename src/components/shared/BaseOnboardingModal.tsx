import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface OnboardingAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link" | "cta" | "dangerOutline";
  disabled?: boolean;
  icon?: ReactNode;
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto md:max-h-none md:h-auto h-full md:rounded-lg rounded-none">
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

        <div className="flex flex-col sm:flex-row gap-4 pt-4 pb-8 sm:justify-center sm:gap-4">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              variant={action.variant || "default"}
              disabled={action.disabled}
              className="flex-1 sm:flex-initial sm:min-w-[140px] min-h-[44px]"
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}