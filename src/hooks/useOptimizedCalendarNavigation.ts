import { useCallback, useMemo } from 'react';
import { addDays, addWeeks, addMonths, format } from 'date-fns';
import { getUserLocale, getStartOfWeek, getEndOfWeek, getDateFnsLocale } from '@/lib/utils';

type ViewMode = 'day' | 'week' | 'month';

/**
 * Optimized calendar navigation with memoized calculations
 * Handles date navigation and view title generation efficiently
 */
export function useOptimizedCalendarNavigation(
  currentDate: Date,
  viewMode: ViewMode,
  setCurrentDate: (date: Date | ((prev: Date) => Date)) => void
) {
  const userLocale = getUserLocale();
  const dateFnsLocale = getDateFnsLocale();

  // Memoized navigation functions to prevent re-creation on every render
  const navigatePrevious = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewMode) {
        case "day":
          return addDays(prev, -1);
        case "week":
          return addWeeks(prev, -1);
        case "month":
          return addMonths(prev, -1);
        default:
          return prev;
      }
    });
  }, [viewMode, setCurrentDate]);

  const navigateNext = useCallback(() => {
    setCurrentDate(prev => {
      switch (viewMode) {
        case "day":
          return addDays(prev, 1);
        case "week":
          return addWeeks(prev, 1);
        case "month":
          return addMonths(prev, 1);
        default:
          return prev;
      }
    });
  }, [viewMode, setCurrentDate]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, [setCurrentDate]);

  // Memoized view title to avoid expensive date formatting on every render
  const viewTitle = useMemo(() => {
    switch (viewMode) {
      case "day":
        return format(currentDate, "EEEE, MMMM d, yyyy", { locale: dateFnsLocale });
      case "week": {
        const weekStart = getStartOfWeek(currentDate, userLocale);
        const weekEnd = getEndOfWeek(currentDate, userLocale);
        return `${format(weekStart, "MMM d", { locale: dateFnsLocale })} - ${format(weekEnd, "MMM d, yyyy", { locale: dateFnsLocale })}`;
      }
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: dateFnsLocale });
      default:
        return '';
    }
  }, [currentDate, viewMode, userLocale, dateFnsLocale]);

  // Memoized keyboard navigation handler
  const handleKeyboardNavigation = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigatePrevious();
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateNext();
        break;
      case 'Home':
        e.preventDefault();
        goToToday();
        break;
      case 'Escape':
        e.preventDefault();
        // Could be used to close modals or reset view
        break;
    }
  }, [navigatePrevious, navigateNext, goToToday]);

  return {
    navigatePrevious,
    navigateNext,
    goToToday,
    viewTitle,
    handleKeyboardNavigation
  };
}
