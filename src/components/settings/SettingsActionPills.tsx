import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

export function SettingsActionPills({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  );
}

type PillButtonProps = Omit<ButtonProps, "children"> & {
  label: string;
  icon?: ReactNode;
  loading?: boolean;
};

export function PillButton({
  label,
  icon,
  loading,
  variant = "pill",
  size = "sm",
  className,
  disabled,
  type = "button",
  ...props
}: PillButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <Button
      type={type}
      variant={variant}
      size={size}
      disabled={isDisabled}
      className={cn("flex items-center gap-2 text-sm", className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {label}
    </Button>
  );
}
