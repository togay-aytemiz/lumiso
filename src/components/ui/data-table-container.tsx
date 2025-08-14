import React from "react";
import { cn } from "@/lib/utils";

interface DataTableContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container component for tables that provides horizontal scrolling
 * without affecting page-level overflow. Keeps headers/toolbars fixed
 * while allowing the table content to scroll horizontally.
 */
export function DataTableContainer({ 
  children, 
  className 
}: DataTableContainerProps) {
  return (
    <div 
      className={cn(
        "w-full max-w-full overflow-x-auto overflow-y-hidden",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border",
        "data-table-container",
        className
      )}
      style={{ maxWidth: '100vw' }}
    >
      <div className="min-w-max">
        {children}
      </div>
    </div>
  );
}