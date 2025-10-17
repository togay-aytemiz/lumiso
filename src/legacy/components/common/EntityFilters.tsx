import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

interface EntityFiltersProps {
  filters: Array<{
    label: string;
    value: string;
    options: FilterOption[];
    onValueChange: (value: string) => void;
    placeholder?: string;
  }>;
  onClearFilters?: () => void;
  actions?: React.ReactNode;
}

export function EntityFilters({
  filters,
  onClearFilters,
  actions
}: EntityFiltersProps) {
  const hasActiveFilters = filters.some(filter => 
    filter.value && filter.value !== 'all' && filter.value !== ''
  );

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
        {filters.map((filter, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {filter.label}:
            </span>
            <Select value={filter.value} onValueChange={filter.onValueChange}>
              <SelectTrigger className="w-full sm:w-48 min-w-0">
                <SelectValue placeholder={filter.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        
        {hasActiveFilters && onClearFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}