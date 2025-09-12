import React, { useEffect } from 'react';

import { useRef } from 'react';

// Performance monitoring utilities for team management

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  public metrics: PerformanceMetric[] = [];
  private timings: Map<string, number> = new Map();

  startTiming(name: string) {
    this.timings.set(name, performance.now());
  }

  endTiming(name: string, metadata?: Record<string, any>) {
    const startTime = this.timings.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.metrics.push({
        name,
        duration,
        timestamp: Date.now(),
        metadata
      });
      this.timings.delete(name);
      
      // Keep only last 100 metrics
      if (this.metrics.length > 100) {
        this.metrics = this.metrics.slice(-100);
      }
    }
  }

  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter(m => m.name === name);
    }
    return [...this.metrics];
  }

  getAverageTime(name: string): number {
    const nameMetrics = this.getMetrics(name);
    if (nameMetrics.length === 0) return 0;
    
    const total = nameMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / nameMetrics.length;
  }

  clear() {
    this.metrics = [];
    this.timings.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Decorator for measuring method performance
export function measurePerformance(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const className = target.constructor.name;
    const methodName = `${className}.${propertyName}`;
    
    performanceMonitor.startTiming(methodName);
    
    try {
      const result = method.apply(this, args);
      
      if (result instanceof Promise) {
        return result.finally(() => {
          performanceMonitor.endTiming(methodName);
        });
      } else {
        performanceMonitor.endTiming(methodName);
        return result;
      }
    } catch (error) {
      performanceMonitor.endTiming(methodName, { error: error.message });
      throw error;
    }
  };
  
  return descriptor;
}

// Hook for measuring component render times
export function useMeasureRender(componentName: string) {
  const renderStart = useRef<number>();
  
  // Measure render start
  renderStart.current = performance.now();
  
  React.useEffect(() => {
    if (renderStart.current) {
      const duration = performance.now() - renderStart.current;
      performanceMonitor.metrics.push({
        name: `${componentName}.render`,
        duration,
        timestamp: Date.now()
      });
    }
  });
}

// Memory usage utility
export function checkMemoryUsage(): { used: number; total: number; percentage: number } | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    };
  }
  return null;
}