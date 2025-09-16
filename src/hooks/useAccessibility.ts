import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for managing focus within a container (focus trap)
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Get all focusable elements
    const getFocusableElements = () => {
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ].join(', ');

      return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Focus first element initially
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      // Restore focus to previously focused element
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for announcing screen reader messages
 */
export function useScreenReader() {
  const announceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcement element if it doesn't exist
    if (!announceRef.current) {
      const element = document.createElement('div');
      element.setAttribute('aria-live', 'polite');
      element.setAttribute('aria-atomic', 'true');
      element.style.position = 'absolute';
      element.style.left = '-10000px';
      element.style.width = '1px';
      element.style.height = '1px';
      element.style.overflow = 'hidden';
      document.body.appendChild(element);
      announceRef.current = element;
    }

    return () => {
      if (announceRef.current && document.body.contains(announceRef.current)) {
        document.body.removeChild(announceRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announceRef.current) {
      announceRef.current.setAttribute('aria-live', priority);
      announceRef.current.textContent = message;
      
      // Clear after announcement to allow repeated messages
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return { announce };
}

/**
 * Hook for managing keyboard navigation in lists
 */
export function useKeyboardNavigation<T>(
  items: T[],
  onSelect?: (item: T, index: number) => void,
  initialIndex: number = -1
) {
  const activeIndexRef = useRef(initialIndex);
  const containerRef = useRef<HTMLElement>(null);

  const setActiveIndex = useCallback((index: number) => {
    const newIndex = Math.max(-1, Math.min(items.length - 1, index));
    activeIndexRef.current = newIndex;
    
    // Update aria-activedescendant
    if (containerRef.current) {
      const activeElement = containerRef.current.querySelector(`[data-index="${newIndex}"]`);
      if (activeElement) {
        containerRef.current.setAttribute('aria-activedescendant', activeElement.id || `item-${newIndex}`);
      } else {
        containerRef.current.removeAttribute('aria-activedescendant');
      }
    }
  }, [items.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const currentIndex = activeIndexRef.current;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(currentIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(currentIndex - 1);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (currentIndex >= 0 && currentIndex < items.length && onSelect) {
          onSelect(items[currentIndex], currentIndex);
        }
        break;
    }
  }, [items, onSelect, setActiveIndex]);

  return {
    activeIndex: activeIndexRef.current,
    setActiveIndex,
    handleKeyDown,
    containerRef
  };
}

/**
 * Hook for managing reduced motion preferences
 */
export function useReducedMotion() {
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion.current;
}

/**
 * Hook for managing high contrast mode
 */
export function useHighContrast() {
  const prefersHighContrast = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    prefersHighContrast.current = mediaQuery.matches;

    const handleChange = (e: MediaQueryListEvent) => {
      prefersHighContrast.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast.current;
}