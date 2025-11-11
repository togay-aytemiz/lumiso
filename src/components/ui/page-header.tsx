import React from "react";
import { UserMenu } from "@/components/UserMenu";
import { cn } from "@/lib/utils";
import { AddAction } from "@/components/AddAction";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageHeader({
  title,
  subtitle: _subtitle,
  children,
  className,
  sticky = false
}: PageHeaderProps) {
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div
      className={cn(
        "max-w-full border-b border-border/60 bg-white dark:bg-white",
        sticky && "lg:sticky lg:top-0 lg:z-10 lg:bg-white dark:lg:bg-white",
        className
      )}
    >
      <div className="px-4 sm:px-6 py-4 lg:py-5">
        {/* Mobile/Tablet Layout */}
        <div className="flex flex-col gap-4 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-shrink-0 min-w-0">
              <h1 className="text-lg font-medium truncate text-foreground transition-all duration-300 ease-out animate-in fade-in slide-in-from-left-2">
                {title}
              </h1>
            </div>
          </div>

          {hasChildren && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
              {children}
            </div>
          )}
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-[auto,minmax(0,1fr),auto] lg:items-center lg:gap-6">
          <div className="flex-shrink-0 min-w-0">
            <h1 className="text-xl font-medium leading-tight truncate text-foreground transition-all duration-300 ease-out animate-in fade-in slide-in-from-left-2">
              {title}
            </h1>
          </div>

          <div
            className={cn(
              "flex items-center gap-3 min-w-0",
              !hasChildren && "justify-end"
            )}
          >
            {hasChildren ? children : null}
          </div>

          <div className="flex items-center justify-end">
            <UserMenu variant="header" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface PageHeaderSearchProps {
  children: React.ReactNode;
  className?: string;
  includeAddAction?: boolean;
}

export function PageHeaderSearch({
  children,
  className,
  includeAddAction = true,
}: PageHeaderSearchProps) {
  return (
    <div
      className={cn(
        "flex-1 min-w-0 w-full transition-[flex-basis,max-width,width] duration-300 ease-out",
        className
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        {includeAddAction ? <AddAction className="flex-shrink-0" /> : null}
      </div>
    </div>
  );
}

interface PageHeaderActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function PageHeaderActions({ children, className }: PageHeaderActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end lg:justify-start",
        className
      )}
    >
      {children}
    </div>
  );
}
