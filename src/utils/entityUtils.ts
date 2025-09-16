/**
 * Entity Utilities - Shared utility functions for entity operations
 */
import { format, parseISO, isValid } from 'date-fns';
import { VALIDATION_MESSAGES, DATE_FILTER_OPTIONS } from '@/constants/entityConstants';

/**
 * Generic sorting function for entity lists
 */
export function sortEntities<T extends Record<string, any>>(
  entities: T[],
  field: keyof T,
  direction: 'asc' | 'desc',
  customComparator?: (a: T[keyof T], b: T[keyof T]) => number
): T[] {
  return [...entities].sort((a, b) => {
    let aValue = a[field];
    let bValue = b[field];

    // Use custom comparator if provided
    if (customComparator) {
      const result = customComparator(aValue, bValue);
      return direction === 'asc' ? result : -result;
    }

    // Handle null/undefined values
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return direction === 'asc' ? -1 : 1;
    if (bValue == null) return direction === 'asc' ? 1 : -1;

    // Handle date strings
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      
      if (isValid(aDate) && isValid(bDate)) {
        aValue = aDate.getTime() as any;
        bValue = bDate.getTime() as any;
      } else {
        // Handle as strings
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
    }

    // Handle numbers
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // Handle strings
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const result = aValue.localeCompare(bValue);
      return direction === 'asc' ? result : -result;
    }

    // Fallback comparison
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Generic filtering function for entity lists
 */
export function filterEntities<T extends Record<string, any>>(
  entities: T[],
  filters: Record<string, any>,
  searchableFields: (keyof T)[] = []
): T[] {
  return entities.filter(entity => {
    // Apply specific field filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '' || value === 'all') {
        continue;
      }

      if (key === 'search' && searchableFields.length > 0) {
        const searchTerm = String(value).toLowerCase();
        const matchesSearch = searchableFields.some(field => {
          const fieldValue = entity[field];
          return fieldValue && String(fieldValue).toLowerCase().includes(searchTerm);
        });
        if (!matchesSearch) return false;
      } else if (entity[key] !== value) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get date range for filter options
 */
export function getDateRangeForFilter(filter: string): { start: Date; end: Date } | null {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  switch (filter) {
    case 'past':
      return { start: new Date(0), end: startOfToday };
    case 'today':
      return { start: startOfToday, end: endOfToday };
    case 'tomorrow':
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const startOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      const endOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1);
      return { start: startOfTomorrow, end: endOfTomorrow };
    case 'thisweek':
      return getWeekRange(today);
    case 'nextweek':
      const nextWeekDate = new Date(today);
      nextWeekDate.setDate(today.getDate() + 7);
      return getWeekRange(nextWeekDate);
    case 'thismonth':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start: startOfMonth, end: endOfMonth };
    case 'nextmonth':
      const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
      return { start: nextMonthStart, end: nextMonthEnd };
    default:
      return null;
  }
}

/**
 * Get week range starting from Monday
 */
function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()),
    end: new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 1)
  };
}

/**
 * Validate form data
 */
export function validateEntityData(
  data: Record<string, any>,
  rules: Record<string, ValidationRule[]>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];

    for (const rule of fieldRules) {
      const error = rule(value);
      if (error) {
        errors[field] = error;
        break; // Stop at first error for this field
      }
    }
  }

  return errors;
}

/**
 * Validation rule type
 */
export type ValidationRule = (value: any) => string | null;

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: (value: any): string | null => {
    if (value === undefined || value === null || value === '') {
      return VALIDATION_MESSAGES.REQUIRED;
    }
    return null;
  },

  email: (value: string): string | null => {
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return VALIDATION_MESSAGES.INVALID_EMAIL;
    }
    return null;
  },

  phone: (value: string): string | null => {
    if (value && !/^[\+]?[\s\-\(\)]?[\d\s\-\(\)]{10,}$/.test(value)) {
      return VALIDATION_MESSAGES.INVALID_PHONE;
    }
    return null;
  },

  date: (value: string): string | null => {
    if (value && !isValid(new Date(value))) {
      return VALIDATION_MESSAGES.INVALID_DATE;
    }
    return null;
  },

  time: (value: string): string | null => {
    if (value && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      return VALIDATION_MESSAGES.INVALID_TIME;
    }
    return null;
  },

  minLength: (min: number) => (value: string): string | null => {
    if (value && value.length < min) {
      return VALIDATION_MESSAGES.MIN_LENGTH(min);
    }
    return null;
  },

  maxLength: (max: number) => (value: string): string | null => {
    if (value && value.length > max) {
      return VALIDATION_MESSAGES.MAX_LENGTH(max);
    }
    return null;
  },

  futureDate: (value: string): string | null => {
    if (value) {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isValid(date) && date < today) {
        return VALIDATION_MESSAGES.FUTURE_DATE;
      }
    }
    return null;
  },

  pastDate: (value: string): string | null => {
    if (value) {
      const date = new Date(value);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (isValid(date) && date > today) {
        return VALIDATION_MESSAGES.PAST_DATE;
      }
    }
    return null;
  },
};

/**
 * Format entity data for display
 */
export function formatEntityValue(value: any, type: 'date' | 'time' | 'currency' | 'phone' | 'email' | 'text'): string {
  if (value == null || value === '') return '-';

  switch (type) {
    case 'date':
      try {
        const date = typeof value === 'string' ? parseISO(value) : value;
        return isValid(date) ? format(date, 'MMM dd, yyyy') : '-';
      } catch {
        return '-';
      }

    case 'time':
      try {
        return format(new Date(`2000-01-01T${value}`), 'h:mm a');
      } catch {
        return value;
      }

    case 'currency':
      const num = Number(value);
      return isNaN(num) ? '-' : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(num);

    case 'phone':
      if (typeof value === 'string' && value.length >= 10) {
        // Simple phone formatting for US numbers
        const digits = value.replace(/\D/g, '');
        if (digits.length === 10) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        if (digits.length === 11 && digits[0] === '1') {
          return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
      }
      return value;

    case 'email':
      return value.toLowerCase();

    case 'text':
    default:
      return String(value);
  }
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get entity count with filters
 */
export function getEntityCountForFilter<T extends Record<string, any>>(
  entities: T[],
  filterKey: string,
  filterValue: string,
  dateField?: keyof T
): number {
  if (filterValue === 'all') return entities.length;

  if (dateField && DATE_FILTER_OPTIONS.find(opt => opt.key === filterValue)) {
    const dateRange = getDateRangeForFilter(filterValue);
    if (!dateRange) return 0;

    return entities.filter(entity => {
      const entityDate = new Date(entity[dateField]);
      return entityDate >= dateRange.start && entityDate < dateRange.end;
    }).length;
  }

  return entities.filter(entity => entity[filterKey] === filterValue).length;
}

/**
 * Generate entity-specific colors for status badges
 */
export function generateStatusColor(status: string, fallbackColors: string[] = []): string {
  const statusColors: Record<string, string> = {
    // Lead statuses
    'new': '#A0AEC0',
    'contacted': '#4299E1',
    'qualified': '#48BB78',
    'booked': '#9F7AEA',
    'completed': '#22c55e',
    'lost': '#ef4444',
    
    // Project statuses
    'planned': '#A0AEC0',
    'in_progress': '#4299E1',
    'on_hold': '#ECC94B',
    'cancelled': '#F56565',
    'archived': '#718096',
    
    // Session statuses
    'confirmed': '#ECC94B',
    'editing': '#9F7AEA',
    'delivered': '#4299E1',
  };

  return statusColors[status.toLowerCase()] || 
         fallbackColors[0] || 
         '#A0AEC0'; // Default gray
}