import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
  variant?: 'default' | 'table' | 'card' | 'dashboard' | 'list' | 'form' | 'search' | 'kanban' | 'page';
  size?: 'sm' | 'md' | 'lg';
  showHeader?: boolean;
  showActions?: boolean;
}

export const LoadingSkeleton = React.memo(({ 
  className, 
  rows = 5, 
  variant = 'default',
  size = 'md',
  showHeader = false,
  showActions = false
}: LoadingSkeletonProps) => {
  if (variant === 'table') {
    return (
      <div className={cn("animate-pulse space-y-4", className)}>
        <div className="h-4 bg-muted rounded w-1/4"></div>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex space-x-4">
              <div className="h-4 bg-muted rounded flex-1"></div>
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-4 bg-muted rounded w-32"></div>
              <div className="h-4 bg-muted rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn("animate-pulse space-y-6", className)}>
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <div className="h-3 bg-muted rounded w-20"></div>
                <div className="h-4 w-4 bg-muted rounded"></div>
              </div>
              <div className="h-6 bg-muted rounded w-12"></div>
              <div className="h-2 bg-muted rounded w-16"></div>
            </div>
          ))}
        </div>
        {/* Content Areas */}
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
              <div className="h-5 bg-muted rounded w-32"></div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-4 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn("animate-pulse space-y-3", className)}>
        {showHeader && (
          <div className="flex justify-between items-center mb-4">
            <div className="h-6 bg-muted rounded w-32"></div>
            {showActions && <div className="h-8 bg-muted rounded w-24"></div>}
          </div>
        )}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
            <div className="h-10 w-10 bg-muted rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
            <div className="h-6 bg-muted rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={cn("animate-pulse space-y-4", className)}>
        {showHeader && <div className="h-6 bg-muted rounded w-48 mb-6"></div>}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-muted rounded w-24"></div>
            <div className="h-10 bg-muted rounded w-full"></div>
          </div>
        ))}
        {showActions && (
          <div className="flex gap-3 pt-4">
            <div className="h-10 bg-muted rounded w-20"></div>
            <div className="h-10 bg-muted rounded w-16"></div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'search') {
    return (
      <div className={cn("animate-pulse space-y-3", className)}>
        <div className="h-10 bg-muted rounded w-full mb-4"></div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-start space-x-3 p-3 border-b">
            <div className="h-8 w-8 bg-muted rounded flex-shrink-0"></div>
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'kanban') {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-80 bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 bg-muted rounded w-24"></div>
                <div className="h-6 w-6 bg-muted rounded"></div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="bg-card border rounded-lg p-3 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                    <div className="flex gap-2">
                      <div className="h-5 bg-muted rounded w-12"></div>
                      <div className="h-5 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", className)}>
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn("animate-pulse space-y-4", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
            <div className="h-3 bg-muted rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("animate-pulse space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-muted rounded w-full"></div>
      ))}
    </div>
  );
});

LoadingSkeleton.displayName = 'LoadingSkeleton';