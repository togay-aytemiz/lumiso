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
      <div className={cn(
        'w-full bg-gray-200 rounded-full overflow-hidden',
        height
      )}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-in-out',
            isComplete ? 'bg-green-500' : 'bg-indigo-500'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      
      {showLabel && total > 0 && (
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-muted-foreground">
            {completed} of {total} todos completed {value > 0 && `(${value}%)`}
          </span>
        </div>
      )}
    </div>
  );
};