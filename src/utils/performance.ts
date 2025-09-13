import React, { useEffect } from 'react';

/**
 * Performance monitoring utilities
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private startTimes: Map<string, number> = new Map();

  startTiming(name: string): void {
    this.startTimes.set(name, performance.now());
  }

  endTiming(name: string): number {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      console.warn(`No start time found for metric: ${name}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.metrics.push({
      name,
      value: duration,
      timestamp: Date.now()
    });

    this.startTimes.delete(name);
    
    // Log slow operations in development
    if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  getAverageTime(name: string): number {
    const relevantMetrics = this.metrics.filter(m => m.name === name);
    if (relevantMetrics.length === 0) return 0;
    
    const total = relevantMetrics.reduce((sum, metric) => sum + metric.value, 0);
    return total / relevantMetrics.length;
  }
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring function execution time
 */
export function measurePerformance(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = function (...args: any[]) {
    const methodName = `${target.constructor.name}.${propertyName}`;
    performanceMonitor.startTiming(methodName);
    
    try {
      const result = method.apply(this, args);
      
      // Handle async functions
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceMonitor.endTiming(methodName);
        });
      }
      
      performanceMonitor.endTiming(methodName);
      return result;
    } catch (error) {
      performanceMonitor.endTiming(methodName);
      throw error;
    }
  };
}

/**
 * Hook for measuring component render performance
 */
export function useMeasureRender(componentName: string) {
  useEffect(() => {
    performanceMonitor.startTiming(`${componentName} render`);
    
    return () => {
      performanceMonitor.endTiming(`${componentName} render`);
    };
  });
}

/**
 * Utility for detecting memory leaks
 */
export function checkMemoryUsage() {
  if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
    const memory = (window.performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576 * 100) / 100,
      total: Math.round(memory.totalJSHeapSize / 1048576 * 100) / 100,
      limit: Math.round(memory.jsHeapSizeLimit / 1048576 * 100) / 100
    };
  }
  return null;
}