import React from 'react';
import { LoadingSkeleton } from './loading-skeleton';
import { cn } from '@/lib/utils';

interface LoadingPresetProps {
  className?: string;
}

// Page-level loading components - using settings variant for better appearance
export const PageLoadingSkeleton = ({ className }: LoadingPresetProps) => (
  <LoadingSkeleton variant="settings" rows={3} showHeader className={className} />
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
  <LoadingSkeleton variant="detail-page" className={className} />
);

// Settings page loading
export const SettingsLoadingSkeleton = ({ className, rows = 3 }: LoadingPresetProps & { rows?: number }) => (
  <LoadingSkeleton variant="settings" rows={rows} showHeader showActions className={className} />
);