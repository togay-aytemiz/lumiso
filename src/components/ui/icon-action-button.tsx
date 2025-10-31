import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type IconActionVariant = "default" | "danger";

export interface IconActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconActionVariant;
}

const variantStyles: Record<IconActionVariant, string> = {
  default:
    "text-muted-foreground hover:text-primary hover:bg-primary/10",
  danger:
    "text-destructive hover:bg-destructive/10",
};

export const IconActionButton = forwardRef<HTMLButtonElement, IconActionButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
);

IconActionButton.displayName = "IconActionButton";
