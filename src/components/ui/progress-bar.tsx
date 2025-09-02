import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  total: number;
  completed: number;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  total,
  completed,
  className,
  showLabel = true,
  size = 'sm',
}) => {
  const height = size === 'sm' ? 'h-2' : 'h-3';
  const isComplete = value === 100;
  
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex-1 bg-muted rounded-full overflow-hidden',
          height
        )}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-in-out',
              isComplete ? 'bg-green-600' : 'bg-primary'
            )}
            style={{ width: `${value}%` }}
          />
        </div>
        
        {showLabel && total > 0 && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completed}/{total}
          </span>
        )}
      </div>
    </div>
  );
};