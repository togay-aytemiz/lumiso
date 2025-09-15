import { useEffect, useRef } from 'react';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface PerformanceMetrics {
  hookCallCount: number;
  lastCallTime: number;
  cacheHits: number;
  cacheMisses: number;
}

const performanceMetrics: PerformanceMetrics = {
  hookCallCount: 0,
  lastCallTime: 0,
  cacheHits: 0,
  cacheMisses: 0
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
    performanceMetrics.hookCallCount++;
    performanceMetrics.lastCallTime = Date.now();
    
    // Warn if excessive re-renders
    if (renderCountRef.current > 20) {
      console.warn('🚨 PerformanceMonitor: Excessive onboarding re-renders detected:', {
        renderCount: renderCountRef.current,
        hookCalls: performanceMetrics.hookCallCount,
        stage,
        currentStep,
        loading
      });
    }
    
    // Reset counter periodically
    const resetTimer = setTimeout(() => {
      renderCountRef.current = 0;
    }, 5000);
    
    return () => clearTimeout(resetTimer);
  }, [stage, currentStep, loading]);

  return null;
}

// Expose metrics for debugging
if (typeof window !== 'undefined') {
  (window as any).onboardingMetrics = performanceMetrics;
}