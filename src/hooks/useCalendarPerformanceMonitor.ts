import { useEffect, useRef, useState } from 'react';
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
  const startRenderTiming = () => {
    performanceMonitor.startTiming('calendar-render');
  };

  // End timing for calendar render
  const endRenderTiming = () => {
    const renderTime = performanceMonitor.endTiming('calendar-render');
    
    setMetrics(prev => ({
      ...prev,
      renderTime
    }));
  };

  // Start timing for data queries
  const startQueryTiming = () => {
    performanceMonitor.startTiming('calendar-query');
  };

  // End timing for data queries
  const endQueryTiming = () => {
    const queryTime = performanceMonitor.endTiming('calendar-query');
    
    setMetrics(prev => ({
      ...prev,
      queryTime
    }));
  };

  // Start timing for event processing
  const startEventProcessing = () => {
    performanceMonitor.startTiming('calendar-event-processing');
  };

  // End timing for event processing
  const endEventProcessing = (eventCount: number) => {
    const eventProcessingTime = performanceMonitor.endTiming('calendar-event-processing');
    
    setMetrics(prev => ({
      ...prev,
      eventProcessingTime,
      totalEvents: eventCount
    }));
  };

  // Update memory usage
  const updateMemoryUsage = () => {
    const memoryUsage = require('@/utils/performance').checkMemoryUsage();
    
    setMetrics(prev => ({
      ...prev,
      memoryUsage
    }));
  };

  // Performance warnings
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const { renderTime, queryTime, eventProcessingTime, totalEvents, memoryUsage } = metrics;
      
      // Warn about slow renders
      if (renderTime > 100) {
        console.warn(`[Calendar Performance] Slow render detected: ${renderTime.toFixed(2)}ms`);
      }
      
      // Warn about slow queries
      if (queryTime > 500) {
        console.warn(`[Calendar Performance] Slow query detected: ${queryTime.toFixed(2)}ms`);
      }
      
      // Warn about slow event processing
      if (eventProcessingTime > 50 && totalEvents > 0) {
        console.warn(`[Calendar Performance] Slow event processing: ${eventProcessingTime.toFixed(2)}ms for ${totalEvents} events`);
      }
      
      // Warn about high memory usage
      if (memoryUsage && memoryUsage.used > memoryUsage.limit * 0.8) {
        console.warn(`[Calendar Performance] High memory usage: ${memoryUsage.used}MB / ${memoryUsage.limit}MB`);
      }
    }
  }, [metrics]);

  // Auto-update memory usage every 5 seconds in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(updateMemoryUsage, 5000);
      return () => clearInterval(interval);
    }
  }, []);

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