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
        {/* Mobile/Tablet Layout: Stack title, then search + actions */}
        <div className="flex flex-col gap-4 lg:hidden">
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-2xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground text-sm truncate md:hidden">{subtitle}</p>
            )}
          </div>
          
          {children && (
            <div className="flex flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
              {children}
            </div>
          )}
        </div>

        {/* Desktop Layout: Title + subtitle on left, search + actions on right, same row */}
        <div className="hidden lg:flex items-center justify-between gap-6">
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-3xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          
          {children && (
            <div className="flex items-center gap-4 flex-shrink-0">
              {children}
            </div>
          )}
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
      // Mobile/Tablet: flexible width that grows
      "flex-1 min-w-0 w-full sm:max-w-lg",
      // Desktop: constrained width
      "lg:max-w-xl",
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
      // Mobile/Tablet: flex-shrink-0 to prevent compression
      "flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end",
      // Desktop: flex-shrink-0, no wrap
      "lg:flex-shrink-0",
      className
    )}>
      {children}
    </div>
  );
}