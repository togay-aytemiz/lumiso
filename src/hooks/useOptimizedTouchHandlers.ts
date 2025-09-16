import { useCallback, useRef } from 'react';

interface TouchHandlerOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number;
  enabled?: boolean;
}

/**
 * Optimized touch handlers using event delegation
 * Single set of handlers instead of individual handlers per component
 */
export function useOptimizedTouchHandlers({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
  enabled = true
}: TouchHandlerOptions) {
  const touchDataRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isTracking: false
  });

  // Memoized touch handlers for better performance
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    touchDataRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isTracking: true
    };
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchDataRef.current.isTracking) return;

    // Prevent default scrolling if we're potentially swiping horizontally
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchDataRef.current.startX);
    const deltaY = Math.abs(touch.clientY - touchDataRef.current.startY);
    
    if (deltaX > deltaY && deltaX > 10) {
      e.preventDefault();
    }
  }, [enabled]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !touchDataRef.current.isTracking) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchDataRef.current.startX;
    const deltaY = touch.clientY - touchDataRef.current.startY;
    const deltaTime = Date.now() - touchDataRef.current.startTime;
    
    touchDataRef.current.isTracking = false;

    // Check if it's a valid swipe (horizontal movement, quick enough, far enough)
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const isFastEnough = deltaTime < 300; // Max 300ms for a swipe
    const isFarEnough = Math.abs(deltaX) > minSwipeDistance;
    
    if (isHorizontalSwipe && isFastEnough && isFarEnough) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }
  }, [enabled, minSwipeDistance, onSwipeLeft, onSwipeRight]);

  const handleTouchCancel = useCallback(() => {
    touchDataRef.current.isTracking = false;
  }, []);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel
  };
}