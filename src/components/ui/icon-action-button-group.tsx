import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface IconActionButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export function IconActionButtonGroup({ children, className }: IconActionButtonGroupProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {children}
    </div>
  );
}
