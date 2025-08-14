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
        {/* All Layouts: Stack title, then search + actions in same row */}
        <div className="flex flex-col gap-4">
          {/* Title row */}
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-2xl lg:text-3xl font-bold truncate">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground text-sm lg:text-base truncate md:hidden lg:block">{subtitle}</p>
            )}
          </div>
          
          {/* Search + Actions row - always together */}
          {children && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
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
      // All layouts: flexible width that grows but allows actions to stay visible
      "flex-1 min-w-0 w-full sm:max-w-lg lg:max-w-xl",
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
      // All layouts: flex-shrink-0 to prevent compression, right-aligned on larger screens
      "flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end",
      className
    )}>
      {children}
    </div>
  );
}