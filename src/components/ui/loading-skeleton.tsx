import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
  variant?: 'default' | 'table' | 'card';
}

export const LoadingSkeleton = React.memo(({ 
  className, 
  rows = 5, 
  variant = 'default' 
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