import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageHeader({ 
  title, 
  subtitle, 
  children, 
  className,
  sticky = false 
}: PageHeaderProps) {
  return (
    <div 
      className={cn(
        "max-w-full overflow-x-hidden",
        sticky && "lg:sticky lg:top-0 lg:z-10 lg:bg-background/95 lg:backdrop-blur-sm lg:border-b",
        className
      )}
    >
      <div className="p-4 sm:p-6">
        {/* Mobile Layout (< 768px): Stack title, search, actions vertically */}
        <div className="flex flex-col gap-4 md:hidden">
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-2xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground text-sm truncate">{subtitle}</p>
            )}
          </div>
          {children}
        </div>

        {/* Tablet Layout (768px - 1024px): Two rows, search takes full width on row 2 */}
        <div className="hidden md:flex lg:hidden flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-shrink-0 min-w-0">
              <h1 className="text-2xl lg:text-3xl font-bold truncate">{title}</h1>
              {subtitle && (
                <p className="text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {children}
        </div>

        {/* Desktop Layout (>= 1024px): Single row with search in center */}
        <div className="hidden lg:flex items-center justify-between gap-6">
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-3xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

interface PageHeaderSearchProps {
  children: React.ReactNode;
  className?: string;
}

export function PageHeaderSearch({ children, className }: PageHeaderSearchProps) {
  return (
    <div className={cn(
      // Mobile: full width
      "w-full",
      // Tablet: full width
      "md:w-full",
      // Desktop: flex-1 with constraints
      "lg:flex-1 lg:max-w-lg lg:min-w-0",
      className
    )}>
      {children}
    </div>
  );
}

interface PageHeaderActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function PageHeaderActions({ children, className }: PageHeaderActionsProps) {
  return (
    <div className={cn(
      // Mobile: full width or right-aligned
      "flex items-center gap-2 w-full sm:w-auto sm:justify-end",
      // Tablet: right-aligned, wraps under search if needed
      "md:w-auto md:justify-end md:flex-wrap",
      // Desktop: right-aligned, no wrap
      "lg:flex-shrink-0 lg:flex-nowrap",
      className
    )}>
      {children}
    </div>
  );
}