/**
 * Entity Utilities - Shared utility functions for entity operations
 */
import { format, parseISO, isValid } from 'date-fns';
import { VALIDATION_MESSAGES, DATE_FILTER_OPTIONS } from '@/constants/entityConstants';

/**
 * Generic sorting function for entity lists
 */
export function sortEntities<T extends Record<string, unknown>>(
  entities: readonly T[],
  field: keyof T,
  direction: 'asc' | 'desc',
  customComparator?: (a: T[keyof T], b: T[keyof T]) => number
): T[] {
  const multiplier = direction === 'asc' ? 1 : -1;

  const applyDirection = (value: number) => {
    if (value === 0) {
      return 0;
    }
    return value > 0 ? multiplier : -multiplier;
  };

  const compareNumbers = (first: number, second: number) =>
    applyDirection(first - second);

  return [...entities].sort((entityA, entityB) => {
    const aValue = entityA[field];
    const bValue = entityB[field];

    if (customComparator) {
      const result = customComparator(aValue, bValue);
      if (result === 0) {
        return 0;
      }
      return multiplier * (result > 0 ? 1 : -1);
    }

    if (aValue == null && bValue == null) {
      return 0;
    }
    if (aValue == null) {
      return -multiplier;
    }
    if (bValue == null) {
      return multiplier;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return compareNumbers(aValue, bValue);
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);

      if (isValid(aDate) && isValid(bDate)) {
        return compareNumbers(aDate.getTime(), bDate.getTime());
      }

      const stringComparison = aValue.localeCompare(bValue);
      return multiplier * stringComparison;
    }

    if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
      return compareNumbers(Number(aValue), Number(bValue));
    }

    const aString = String(aValue);
    const bString = String(bValue);
    const fallbackComparison = aString.localeCompare(bString);
    return multiplier * fallbackComparison;
  });
}

/**
 * Generic filtering function for entity lists
 */
export function filterEntities<T extends Record<string, unknown>>(
  entities: readonly T[],
  filters: Partial<Record<string, unknown>>,
  searchableFields: (keyof T)[] = []
): T[] {
  return entities.filter(entity => {
    // Apply specific field filters
    for (const [key, value] of Object.entries(filters)) {
      if (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && (value === '' || value === 'all'))
      ) {
        continue;
      }

      if (key === 'search' && searchableFields.length > 0) {
        const searchTerm = String(value).toLowerCase();
        const matchesSearch = searchableFields.some(field => {
          const fieldValue = entity[field];
          if (fieldValue === undefined || fieldValue === null) {
            return false;
          }
          return String(fieldValue).toLowerCase().includes(searchTerm);
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
    case 'tomorrow': {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const startOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      const endOfTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1);
      return { start: startOfTomorrow, end: endOfTomorrow };
    }
    case 'thisweek':
      return getWeekRange(today);
    case 'nextweek': {
      const nextWeekDate = new Date(today);
      nextWeekDate.setDate(today.getDate() + 7);
      return getWeekRange(nextWeekDate);
    }
    case 'thismonth': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start: startOfMonth, end: endOfMonth };
    }
    case 'nextmonth': {
      const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 1);
      return { start: nextMonthStart, end: nextMonthEnd };
    }
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
  data: Record<string, unknown>,
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
export type ValidationRule = (value: unknown) => string | null;

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: (value: unknown): string | null => {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return VALIDATION_MESSAGES.REQUIRED;
    }
    return null;
  },

  email: (value: unknown): string | null => {
    if (typeof value === 'string' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return VALIDATION_MESSAGES.INVALID_EMAIL;
    }
    return null;
  },

  phone: (value: unknown): string | null => {
    if (typeof value === 'string' && value && !/^[+]?[\s()-]?[\d\s()-]{10,}$/.test(value)) {
      return VALIDATION_MESSAGES.INVALID_PHONE;
    }
    return null;
  },

  date: (value: unknown): string | null => {
    if (
      (typeof value === 'string' || value instanceof Date || typeof value === 'number') &&
      !isValid(new Date(value))
    ) {
      return VALIDATION_MESSAGES.INVALID_DATE;
    }
    return null;
  },

  time: (value: unknown): string | null => {
    if (typeof value === 'string' && value && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      return VALIDATION_MESSAGES.INVALID_TIME;
    }
    return null;
  },

  minLength: (min: number) => (value: unknown): string | null => {
    if (typeof value === 'string' && value.length < min) {
      return VALIDATION_MESSAGES.MIN_LENGTH(min);
    }
    return null;
  },

  maxLength: (max: number) => (value: unknown): string | null => {
    if (typeof value === 'string' && value.length > max) {
      return VALIDATION_MESSAGES.MAX_LENGTH(max);
    }
    return null;
  },

  futureDate: (value: unknown): string | null => {
    if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (isValid(date) && date < today) {
        return VALIDATION_MESSAGES.FUTURE_DATE;
      }
    }
    return null;
  },

  pastDate: (value: unknown): string | null => {
    if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
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
export function formatEntityValue(
  value: unknown,
  type: 'date' | 'time' | 'currency' | 'phone' | 'email' | 'text'
): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string' && value === '') return '-';

  switch (type) {
    case 'date': {
      try {
        if (typeof value === 'string') {
          const parsed = parseISO(value);
          return isValid(parsed) ? format(parsed, 'MMM dd, yyyy') : '-';
        }
        if (value instanceof Date) {
          return isValid(value) ? format(value, 'MMM dd, yyyy') : '-';
        }
        return '-';
      }
      catch {
        return '-';
      }
    }

    case 'time': {
      try {
        if (typeof value !== 'string') {
          return '-';
        }
        return format(new Date(`2000-01-01T${value}`), 'h:mm a');
      } catch {
        return '-';
      }
    }

    case 'currency': {
      const num = typeof value === 'number' ? value : Number(value);
      return isNaN(num) ? '-' : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(num);
    }

    case 'phone': {
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
      return typeof value === 'string' ? value : String(value);
    }

    case 'email':
      return typeof value === 'string' ? value.toLowerCase() : '-';

    case 'text':
    default:
      return String(value);
  }
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get entity count with filters
 */
export function getEntityCountForFilter<T extends Record<string, unknown>>(
  entities: readonly T[],
  filterKey: keyof T | string,
  filterValue: string,
  dateField?: keyof T
): number {
  if (filterValue === 'all') return entities.length;

  if (dateField && DATE_FILTER_OPTIONS.find(opt => opt.key === filterValue)) {
    const dateRange = getDateRangeForFilter(filterValue);
    if (!dateRange) return 0;

    return entities.filter(entity => {
      const rawValue = entity[dateField];
      if (
        typeof rawValue !== 'string' &&
        typeof rawValue !== 'number' &&
        !(rawValue instanceof Date)
      ) {
        return false;
      }
      const entityDate = new Date(rawValue);
      return isValid(entityDate) && entityDate >= dateRange.start && entityDate < dateRange.end;
    }).length;
  }

  return entities.filter(entity => {
    const entityValue = entity[filterKey as keyof T];
    return entityValue === filterValue;
  }).length;
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
