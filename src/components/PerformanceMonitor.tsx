import { useEffect, useRef } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface PerformanceMetrics {
  hookCallCount: number;
  lastCallTime: number;
  cacheHits: number;
  cacheMisses: number;
}

  // Disable performance monitor logs
  const performanceMonitor = {
    clearMetrics: () => {},
    getMetrics: () => []
  };

export function PerformanceMonitor() {
  const renderCountRef = useRef(0);
  const { stage, currentStep, loading } = useOnboarding();
  
  // Only run in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  useEffect(() => {
    renderCountRef.current++;
    
    // Warn if excessive re-renders (reduced threshold for prod)
    if (renderCountRef.current > 50) {
      console.warn('🚨 PerformanceMonitor: Excessive onboarding re-renders detected:', {
        renderCount: renderCountRef.current,
        stage,
        currentStep,
        loading
      });
    }
    
    // Reset counter periodically
    const resetTimer = setTimeout(() => {
      renderCountRef.current = 0;
    }, 10000);
    
    return () => clearTimeout(resetTimer);
  }, [stage, currentStep, loading]);

  return null;
}

// Development-only metrics exposure
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).onboardingMetrics = { renderCount: 0 };
}