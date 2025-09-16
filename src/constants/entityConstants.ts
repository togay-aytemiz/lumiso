/**
 * Entity Constants - Centralized constants for leads, projects, and sessions
 */

// Pagination constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MOBILE_PAGE_SIZE: 10,
} as const;

export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted', 
  QUALIFIED: 'qualified',
  BOOKED: 'booked',
  COMPLETED: 'completed',
  LOST: 'lost'
} as const;

export const PROJECT_STATUS = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress', 
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived'
} as const;

// Status options for different entities
export const LEAD_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "lost", label: "Lost" },
] as const;

export const SESSION_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "planned", label: "Planned" },
  { value: "confirmed", label: "Confirmed" },
  { value: "editing", label: "Editing" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const PROJECT_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
] as const;

// Date filter options
export const DATE_FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "past", label: "Past" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "thisweek", label: "This Week" },
  { key: "nextweek", label: "Next Week" },
  { key: "thismonth", label: "This Month" },
  { key: "nextmonth", label: "Next Month" },
] as const;

// Sort field options
export const LEAD_SORT_FIELDS = [
  'name', 'email', 'phone', 'status', 'due_date', 'created_at', 'updated_at'
] as const;

export const PROJECT_SORT_FIELDS = [
  'name', 'lead_name', 'project_type', 'status', 'created_at', 'updated_at'
] as const;

export const SESSION_SORT_FIELDS = [
  'session_date', 'session_time', 'status', 'lead_name', 'created_at'
] as const;

// Default time slots for sessions
export const DEFAULT_TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"
] as const;

// Entity lifecycle states
export const LIFECYCLE_STATES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Form validation messages
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_DATE: 'Please enter a valid date',
  INVALID_TIME: 'Please enter a valid time',
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Must be no more than ${max} characters`,
  FUTURE_DATE: 'Date must be in the future',
  PAST_DATE: 'Date must be in the past',
} as const;

// Default form values
export const DEFAULT_FORM_VALUES = {
  LEAD: {
    name: '',
    email: '',
    phone: '',
    notes: '',
    status: 'new',
  },
  PROJECT: {
    name: '',
    description: '',
    base_price: 0,
  },
  SESSION: {
    session_time: '10:00',
    notes: '',
    status: 'planned',
    location: '',
  },
} as const;

// Loading states
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

// Error messages for common operations
export const ERROR_MESSAGES = {
  FETCH_FAILED: 'Failed to load data. Please try again.',
  CREATE_FAILED: 'Failed to create item. Please try again.',
  UPDATE_FAILED: 'Failed to update item. Please try again.',
  DELETE_FAILED: 'Failed to delete item. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested item was not found.',
  VALIDATION_ERROR: 'Please fix the validation errors and try again.',
} as const;

// Success messages for common operations
export const SUCCESS_MESSAGES = {
  CREATED: (entity: string) => `${entity} created successfully`,
  UPDATED: (entity: string) => `${entity} updated successfully`,
  DELETED: (entity: string) => `${entity} deleted successfully`,
  SAVED: 'Changes saved successfully',
  COPIED: 'Copied to clipboard',
  EXPORTED: 'Data exported successfully',
} as const;

// Entity display names
export const ENTITY_NAMES = {
  LEAD: 'Lead',
  LEADS: 'Leads',
  PROJECT: 'Project',
  PROJECTS: 'Projects',
  SESSION: 'Session',
  SESSIONS: 'Sessions',
} as const;

// Export types for TypeScript
export type PaginationConstant = typeof PAGINATION;
export type LeadStatusOption = typeof LEAD_STATUS_OPTIONS[number];
export type SessionStatusOption = typeof SESSION_STATUS_OPTIONS[number];
export type ProjectStatusOption = typeof PROJECT_STATUS_OPTIONS[number];
export type DateFilterOption = typeof DATE_FILTER_OPTIONS[number];
export type LeadSortField = typeof LEAD_SORT_FIELDS[number];
export type ProjectSortField = typeof PROJECT_SORT_FIELDS[number];
export type SessionSortField = typeof SESSION_SORT_FIELDS[number];
export type DefaultTimeSlot = typeof DEFAULT_TIME_SLOTS[number];
export type LifecycleState = typeof LIFECYCLE_STATES[keyof typeof LIFECYCLE_STATES];
export type LoadingState = typeof LOADING_STATES[keyof typeof LOADING_STATES];