import { useState, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';

/**
 * Optimized viewport detection hook with debounced resize handling
 * Caches viewport calculations to avoid repeated window.innerWidth checks
 */
export function useOptimizedViewport() {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));

  // Memoized device type detection
  const deviceInfo = useMemo(() => {
    const isMobile = viewport.width <= 768;
    const isTablet = viewport.width > 768 && viewport.width <= 1024;
    const isDesktop = viewport.width > 1024;
    
    return {
      isMobile,
      isTablet,
      isDesktop,
      breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'
    };
  }, [viewport.width]);

  useEffect(() => {
    // Debounced resize handler to avoid excessive re-renders
    const debouncedResize = debounce(() => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, 150);

    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      debouncedResize.cancel();
    };
  }, []);

  return {
    ...viewport,
    ...deviceInfo
  };
}