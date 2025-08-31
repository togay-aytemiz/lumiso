import React from 'react';
import { LoadingSkeleton } from './loading-skeleton';
import { cn } from '@/lib/utils';

interface LoadingPresetProps {
  className?: string;
}

// Page-level loading components
export const PageLoadingSkeleton = ({ className }: LoadingPresetProps) => (
  <LoadingSkeleton variant="page" className={className} />
);

export const DashboardLoadingSkeleton = ({ className }: LoadingPresetProps) => (
  <div className={cn("p-4 sm:p-6", className)}>
    <LoadingSkeleton variant="dashboard" />
  </div>
);

export const TableLoadingSkeleton = ({ className, rows = 10 }: LoadingPresetProps & { rows?: number }) => (
  <div className={cn("p-4", className)}>
    <LoadingSkeleton variant="table" rows={rows} showHeader />
  </div>
);

export const ListLoadingSkeleton = ({ className, rows = 8 }: LoadingPresetProps & { rows?: number }) => (
  <div className={cn("p-4", className)}>
    <LoadingSkeleton variant="list" rows={rows} showHeader showActions />
  </div>
);

export const KanbanLoadingSkeleton = ({ className }: LoadingPresetProps) => (
  <div className={cn("p-4 sm:p-6", className)}>
    <LoadingSkeleton variant="kanban" />
  </div>
);

export const FormLoadingSkeleton = ({ className, rows = 6 }: LoadingPresetProps & { rows?: number }) => (
  <div className={cn("p-6", className)}>
    <LoadingSkeleton variant="form" rows={rows} showHeader showActions />
  </div>
);

export const SearchLoadingSkeleton = ({ className, rows = 5 }: LoadingPresetProps & { rows?: number }) => (
  <div className={cn("p-4", className)}>
    <LoadingSkeleton variant="search" rows={rows} />
  </div>
);

// Compact variants for smaller contexts
export const CompactLoadingSkeleton = ({ className }: LoadingPresetProps) => (
  <div className={cn("flex items-center justify-center py-8", className)}>
    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
  </div>
);

// Card grid loading
export const CardGridLoadingSkeleton = ({ className, count = 6 }: LoadingPresetProps & { count?: number }) => (
  <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="animate-pulse border rounded-lg p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4"></div>
        <div className="h-3 bg-muted rounded w-1/2"></div>
        <div className="h-3 bg-muted rounded w-2/3"></div>
      </div>
    ))}
  </div>
);

// Detail page loading
export const DetailPageLoadingSkeleton = ({ className }: LoadingPresetProps) => (
  <div className={cn("p-4 sm:p-6 space-y-6", className)}>
    {/* Header */}
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-64"></div>
      <div className="h-4 bg-muted rounded w-96"></div>
    </div>
    
    {/* Content sections */}
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse border rounded-lg p-6 space-y-4">
            <div className="h-5 bg-muted rounded w-32"></div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-4 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="space-y-6">
        <div className="animate-pulse border rounded-lg p-6 space-y-4">
          <div className="h-5 bg-muted rounded w-24"></div>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-3 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);