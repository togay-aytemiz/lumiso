import { useMemo, useCallback } from 'react';
import { useOptimizedViewport } from './useOptimizedViewport';

type ViewMode = 'day' | 'week' | 'month';

/**
 * Calendar-specific viewport optimizations
 * Handles view mode preferences and touch interactions
 */
export function useOptimizedCalendarViewport(
  viewMode: ViewMode,
  setViewMode: (mode: ViewMode) => void,
  setCurrentDate: (date: Date | ((prev: Date) => Date)) => void
) {
  const { isMobile, isTablet, isDesktop } = useOptimizedViewport();

  // Memoized view configuration based on device
  const viewConfig = useMemo(() => {
    return {
      defaultViewMode: isMobile ? 'day' : 'month',
      maxVisibleEvents: isMobile ? 2 : isTablet ? 3 : 4,
      showEventTime: !isMobile,
      enableSwipeNavigation: isMobile || isTablet,
      showFullEventDetails: isDesktop
    };
  }, [isMobile, isTablet, isDesktop]);

  // Optimized day click handler
  const handleDayClick = useCallback((date: Date) => {
    if (isMobile) {
      setCurrentDate(date);
      setViewMode('day');
    }
  }, [isMobile, setCurrentDate, setViewMode]);

  // Touch navigation handlers with proper cleanup
  const createTouchHandlers = useCallback(() => {
    if (!viewConfig.enableSwipeNavigation) return {};

    let touchStart: number | null = null;
    let touchEnd: number | null = null;

    const handleTouchStart = (e: React.TouchEvent) => {
      touchEnd = null;
      touchStart = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      touchEnd = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = (onNext: () => void, onPrevious: () => void) => {
      if (!touchStart || !touchEnd) return;
      
      const distance = touchStart - touchEnd;
      const minSwipeDistance = 50;

      if (Math.abs(distance) > minSwipeDistance) {
        if (distance > 0) {
          onNext(); // Swipe left - next
        } else {
          onPrevious(); // Swipe right - previous
        }
      }
    };

    return {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd
    };
  }, [viewConfig.enableSwipeNavigation]);

  return {
    isMobile,
    isTablet,
    isDesktop,
    viewConfig,
    handleDayClick,
    createTouchHandlers
  };
}