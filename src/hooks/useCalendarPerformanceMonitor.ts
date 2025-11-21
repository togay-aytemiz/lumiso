import { useCallback, useEffect, useRef, useState } from 'react';
import { performanceMonitor } from '@/utils/performance';

interface PerformanceMetrics {
  renderTime: number;
  queryTime: number;
  eventProcessingTime: number;
  totalEvents: number;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  } | null;
}

type PerformanceMemory = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

const hasPerformanceMemory = (
  target: Performance
): target is Performance & { memory: PerformanceMemory } => {
  const potentialMemory = (target as { memory?: PerformanceMemory }).memory;
  return (
    typeof potentialMemory?.usedJSHeapSize === 'number' &&
    typeof potentialMemory.totalJSHeapSize === 'number' &&
    typeof potentialMemory.jsHeapSizeLimit === 'number'
  );
};

/**
 * Performance monitoring hook specifically for calendar operations
 * Tracks render times, query performance, and memory usage
 */
export function useCalendarPerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    queryTime: 0,
    eventProcessingTime: 0,
    totalEvents: 0,
    memoryUsage: null
  });

  const metricsRef = useRef<PerformanceMetrics>(metrics);
  metricsRef.current = metrics;

  // Start timing for calendar render
  const startRenderTiming = useCallback(() => {
    performanceMonitor.startTiming('calendar-render');
  }, []);

  // End timing for calendar render
  const endRenderTiming = useCallback(() => {
    const renderTime = performanceMonitor.endTiming('calendar-render');
    
    setMetrics(prev => ({
      ...prev,
      renderTime
    }));
  }, []);

  // Start timing for data queries
  const startQueryTiming = useCallback(() => {
    performanceMonitor.startTiming('calendar-query');
  }, []);

  // End timing for data queries
  const endQueryTiming = useCallback(() => {
    const queryTime = performanceMonitor.endTiming('calendar-query');
    
    setMetrics(prev => ({
      ...prev,
      queryTime
    }));
  }, []);

  // Start timing for event processing
  const startEventProcessing = useCallback(() => {
    performanceMonitor.startTiming('calendar-event-processing');
  }, []);

  // End timing for event processing
  const endEventProcessing = useCallback((eventCount: number) => {
    const eventProcessingTime = performanceMonitor.endTiming('calendar-event-processing');
    
    setMetrics(prev => ({
      ...prev,
      eventProcessingTime,
      totalEvents: eventCount
    }));
  }, []);

  // Update memory usage
  const updateMemoryUsage = useCallback(() => {
    // Browser-compatible memory usage check
    const memoryUsage =
      typeof performance !== 'undefined' && hasPerformanceMemory(performance)
        ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
          }
        : null;
    
    setMetrics(prev => ({
      ...prev,
      memoryUsage
    }));
  }, []);

  const warnStateRef = useRef({
    render: 0,
    query: 0,
    event: 0,
    memoryWarned: false,
  });

  // Performance warnings (development only, throttled per metric)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const { renderTime, queryTime, eventProcessingTime, totalEvents, memoryUsage } =
      metrics;
    const warnState = warnStateRef.current;

    const maybeWarn = (
      shouldWarn: boolean,
      key: 'render' | 'query' | 'event',
      message: string,
      deltaThreshold = 150
    ) => {
      if (!shouldWarn) return;
      if (metrics[key === 'event' ? 'eventProcessingTime' : `${key}Time` as keyof typeof metrics] === undefined) {
        return;
      }
      const latest =
        key === 'render'
          ? renderTime
          : key === 'query'
          ? queryTime
          : eventProcessingTime;
      if (latest - warnState[key] < deltaThreshold) return;
      warnState[key] = latest;
      console.warn(message);
    };

    maybeWarn(
      renderTime > 300,
      'render',
      `[Calendar Performance] Slow render detected: ${renderTime.toFixed(2)}ms`
    );

    maybeWarn(
      queryTime > 800,
      'query',
      `[Calendar Performance] Slow query detected: ${queryTime.toFixed(2)}ms`,
      200
    );

    maybeWarn(
      eventProcessingTime > 120 && totalEvents > 0,
      'event',
      `[Calendar Performance] Slow event processing: ${eventProcessingTime.toFixed(
        2
      )}ms for ${totalEvents} events`,
      120
    );

    if (
      memoryUsage &&
      !warnState.memoryWarned &&
      memoryUsage.used > memoryUsage.limit * 0.85
    ) {
      warnState.memoryWarned = true;
      console.warn(
        `[Calendar Performance] High memory usage: ${memoryUsage.used}MB / ${memoryUsage.limit}MB`
      );
    }
  }, [metrics]);

  // Auto-update memory usage every 5 seconds in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(updateMemoryUsage, 5000);
      return () => clearInterval(interval);
    }
  }, [updateMemoryUsage]);

  // Performance summary
  const getPerformanceSummary = () => {
    const { renderTime, queryTime, eventProcessingTime, totalEvents } = metricsRef.current;
    
    return {
      totalTime: renderTime + queryTime + eventProcessingTime,
      renderTime,
      queryTime,
      eventProcessingTime,
      eventsPerSecond: totalEvents > 0 && eventProcessingTime > 0 
        ? (totalEvents / (eventProcessingTime / 1000)).toFixed(2)
        : 0,
      grade: renderTime < 50 && queryTime < 200 && eventProcessingTime < 30 ? 'A' :
             renderTime < 100 && queryTime < 500 && eventProcessingTime < 50 ? 'B' :
             renderTime < 200 && queryTime < 1000 && eventProcessingTime < 100 ? 'C' : 'D'
    };
  };

  return {
    metrics,
    startRenderTiming,
    endRenderTiming,
    startQueryTiming,
    endQueryTiming,
    startEventProcessing,
    endEventProcessing,
    updateMemoryUsage,
    getPerformanceSummary
  };
}
