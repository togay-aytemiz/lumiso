import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SurfacePadding = "none" | "sm" | "md";
type SurfaceRadius = "lg" | "xl";

const paddingClasses: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
};

const radiusClasses: Record<SurfaceRadius, string> = {
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
}

export const Surface = forwardRef<HTMLElement, SurfaceProps>(
  ({ as = "section", padding = "md", radius = "xl", className, children, ...props }, ref) => {
    const Component: keyof JSX.IntrinsicElements = as;
    return (
      <Component
        ref={ref}
        className={cn(
          radiusClasses[radius],
          "border border-border/70 bg-white/80 shadow-sm",
          paddingClasses[padding],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Surface.displayName = "Surface";
