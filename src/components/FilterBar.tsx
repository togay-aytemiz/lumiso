import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';
import { useTranslation } from "react-i18next";
import { useFormsTranslation } from '@/hooks/useTypedTranslation';
import { cn } from '@/lib/utils';

interface FilterOption {
  key: string;
  label: string;
  count?: number;
}

interface FilterBarProps {
  // Quick filters (All, Today, Tomorrow)
  quickFilters: FilterOption[];
  activeQuickFilter: string;
  onQuickFilterChange: (filter: string) => void;
  
  // All date filters
  allDateFilters?: FilterOption[];
  activeDateFilter?: string;
  onDateFilterChange?: (filter: string) => void;
  
  // Status filters
  statusOptions?: FilterOption[];
  activeStatus?: string;
  onStatusChange?: (status: string) => void;
  
  // Show completed toggle (for reminders)
  showCompleted?: boolean;
  onShowCompletedChange?: (show: boolean) => void;
  showCompletedLabel?: string;
  
  // Sticky behavior
  isSticky?: boolean;
  className?: string;
}

export function FilterBar({
  quickFilters,
  activeQuickFilter,
  onQuickFilterChange,
  allDateFilters,
  activeDateFilter,
  onDateFilterChange,
  statusOptions,
  activeStatus,
  onStatusChange,
  showCompleted,
  onShowCompletedChange,
  showCompletedLabel,
  isSticky = true,
  className = ""
}: FilterBarProps) {
  const { t: tForms } = useFormsTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // Use forms namespace for FilterBar-specific strings
  const { t } = useTranslation('forms');

  const pillButtonBaseClasses =
    'rounded-full border border-border/60 bg-background text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0';
  const pillButtonActiveClasses =
    'bg-primary/10 text-primary border-primary/40 shadow-sm hover:bg-primary/15';
  const pillBadgeBaseClasses =
    'h-5 min-w-[1.75rem] rounded-full border border-border/50 bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors';
  const pillBadgeActiveClasses =
    'border-primary/30 bg-primary/15 text-primary';
  
  // Use translation as default if no label provided
  const completedLabel = showCompletedLabel || tForms('filterBar.showCompleted');
  
  // Calculate active filter count for badge
  const getActiveFilterCount = () => {
    let count = 0;
    
    // Count active status filter (if not "all")
    if (activeStatus && activeStatus !== "all") count++;
    
    // Count active date filter beyond quick filters
    if (activeDateFilter && !quickFilters.some(qf => qf.key === activeDateFilter)) count++;
    
    // Count show completed if enabled
    if (showCompleted) count++;
    
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  // Apply filters and close sheet
  const handleApplyFilters = () => {
    setIsSheetOpen(false);
  };

  // Clear all filters
  const handleClearFilters = () => {
    onQuickFilterChange('all');
    onDateFilterChange?.('all');
    onStatusChange?.('all');
    onShowCompletedChange?.(false);
    setIsSheetOpen(false);
  };

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Status Filter */}
      {statusOptions && onStatusChange && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("filterBar.status")}</Label>
          <Select value={activeStatus} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Date Filters */}
      {allDateFilters && onDateFilterChange && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("filterBar.date_range")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {allDateFilters.map((option) => (
              <Button
                key={option.key}
                variant="outline"
                size="sm"
                onClick={() => onDateFilterChange(option.key)}
                className={cn(
                  'h-9 justify-start',
                  pillButtonBaseClasses,
                  activeDateFilter === option.key && pillButtonActiveClasses
                )}
              >
                {option.label}
                {option.count !== undefined && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'ml-auto',
                      pillBadgeBaseClasses,
                      activeDateFilter === option.key && pillBadgeActiveClasses
                    )}
                  >
                    {option.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Show Completed Toggle */}
      {onShowCompletedChange && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("filterBar.options")}</Label>
          <div className="flex items-center justify-between">
            <Label htmlFor="show-completed" className="text-sm">
              {completedLabel}
            </Label>
            <Switch
              id="show-completed"
              checked={showCompleted || false}
              onCheckedChange={onShowCompletedChange}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div 
      className={`bg-background border-b ${isSticky ? 'sticky top-0 z-30' : ''} ${className}`}
      style={isSticky ? { backdropFilter: 'blur(8px)' } : {}}
    >
      <div className="px-4 sm:px-6 py-3">
        {/* Mobile Layout Only - never show desktop content here */}
        <div className="space-y-3">
          {/* Quick filters + Filters button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {quickFilters.slice(0, 3).map((filter) => {
                const isActive = activeQuickFilter === filter.key;
                return (
                  <Button
                    key={filter.key}
                    variant="outline"
                    size="sm"
                    onClick={() => onQuickFilterChange(filter.key)}
                    className={cn(
                      'whitespace-nowrap flex-shrink-0 hidden md:inline-flex',
                      pillButtonBaseClasses,
                      isActive && pillButtonActiveClasses
                    )}
                  >
                    {filter.label}
                    {filter.count !== undefined && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-1',
                          pillBadgeBaseClasses,
                          isActive && pillBadgeActiveClasses
                        )}
                      >
                        {filter.count}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
            
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative flex-shrink-0">
                  <Filter className="h-4 w-4" />
                  <span className="ml-1">{t("filterBar.filters")}</span>
                  {activeFilterCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs flex items-center justify-center"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>{t("filterBar.filters")}</SheetTitle>
                </SheetHeader>
                <div className="py-6">
                  <FilterContent />
                </div>
                <SheetFooter className="gap-2">
                  <Button variant="ghost" onClick={handleClearFilters} className="flex-1">
                    {t("filterBar.clear_all")}
                  </Button>
                  <Button onClick={handleApplyFilters} className="flex-1">
                    {t("filterBar.apply")}
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* Note: Show Completed toggle for reminders is now only in the sheet, not inline */}
        </div>
      </div>
    </div>
  );
}
