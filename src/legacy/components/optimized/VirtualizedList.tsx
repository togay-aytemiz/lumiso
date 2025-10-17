import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { performanceMonitor } from '@/utils/performance';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  className?: string;
  'aria-label'?: string;
}

/**
 * High-performance virtualized list component
 * Only renders items that are currently visible
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
  className = '',
  'aria-label': ariaLabel = 'Virtual list'
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  // Calculate visible range with memoization
  const { startIndex, endIndex, visibleItems } = useMemo(() => {
    performanceMonitor.startTiming('VirtualizedList.calculateRange');
    
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    
    const visible = items.slice(start, end + 1);
    
    performanceMonitor.endTiming('VirtualizedList.calculateRange');
    
    return {
      startIndex: start,
      endIndex: end,
      visibleItems: visible
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, items]);

  // Optimized scroll handler with requestAnimationFrame
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    requestAnimationFrame(() => {
      setScrollTop(target.scrollTop);
    });
  }, []);

  // Keyboard navigation support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!scrollElementRef.current) return;

    const container = scrollElementRef.current;
    let newScrollTop = scrollTop;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newScrollTop = Math.min(
          (items.length - 1) * itemHeight,
          scrollTop + itemHeight
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        newScrollTop = Math.max(0, scrollTop - itemHeight);
        break;
      case 'PageDown':
        e.preventDefault();
        newScrollTop = Math.min(
          (items.length - 1) * itemHeight,
          scrollTop + containerHeight
        );
        break;
      case 'PageUp':
        e.preventDefault();
        newScrollTop = Math.max(0, scrollTop - containerHeight);
        break;
      case 'Home':
        if (e.ctrlKey) {
          e.preventDefault();
          newScrollTop = 0;
        }
        break;
      case 'End':
        if (e.ctrlKey) {
          e.preventDefault();
          newScrollTop = (items.length - 1) * itemHeight;
        }
        break;
    }

    if (newScrollTop !== scrollTop) {
      container.scrollTop = newScrollTop;
    }
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  // Total height for scrollbar
  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="list"
      aria-label={ariaLabel}
      aria-rowcount={items.length}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            position: 'absolute',
            width: '100%'
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
              role="listitem"
              aria-rowindex={startIndex + index + 1}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for managing virtualized list state
 */
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const targetScrollTop = Math.max(0, Math.min(
      index * itemHeight,
      (items.length - 1) * itemHeight
    ));
    setScrollTop(targetScrollTop);
  }, [itemHeight, items.length]);

  const scrollToTop = useCallback(() => {
    setScrollTop(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    setScrollTop((items.length - 1) * itemHeight);
  }, [items.length, itemHeight]);

  return {
    scrollTop,
    scrollToIndex,
    scrollToTop,
    scrollToBottom
  };
}