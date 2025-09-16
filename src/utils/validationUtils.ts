import { VALIDATION_MESSAGES } from '@/constants/entityConstants';
import { EntityFormField } from '@/components/common/EntityForm';

export interface ValidationRule {
  type: 'required' | 'email' | 'phone' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message?: string;
  validator?: (value: any) => boolean;
}

/**
 * Validate a single field value against its validation rules
 */
export function validateField(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    let isValid = true;
    let errorMessage = rule.message;

    switch (rule.type) {
      case 'required':
        isValid = value !== null && value !== undefined && value !== '';
        if (!isValid && !errorMessage) {
          errorMessage = VALIDATION_MESSAGES.REQUIRED;
        }
        break;

      case 'email':
        if (value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          isValid = emailRegex.test(value);
          if (!isValid && !errorMessage) {
            errorMessage = VALIDATION_MESSAGES.INVALID_EMAIL;
          }
        }
        break;

      case 'phone':
        if (value) {
          // Basic phone validation - adjust regex as needed for your locale
          const phoneRegex = /^[\+]?[\d\s\-\(\)]+$/;
          isValid = phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10;
          if (!isValid && !errorMessage) {
            errorMessage = VALIDATION_MESSAGES.INVALID_PHONE;
          }
        }
        break;

      case 'minLength':
        if (value && typeof value === 'string') {
          isValid = value.length >= (rule.value || 0);
          if (!isValid && !errorMessage) {
            errorMessage = VALIDATION_MESSAGES.MIN_LENGTH(rule.value || 0);
          }
        }
        break;

      case 'maxLength':
        if (value && typeof value === 'string') {
          isValid = value.length <= (rule.value || 0);
          if (!isValid && !errorMessage) {
            errorMessage = VALIDATION_MESSAGES.MAX_LENGTH(rule.value || 0);
          }
        }
        break;

      case 'min':
        if (value !== null && value !== undefined) {
          const numValue = typeof value === 'string' ? parseFloat(value) : value;
          isValid = !isNaN(numValue) && numValue >= (rule.value || 0);
          if (!isValid && !errorMessage) {
            errorMessage = `Value must be at least ${rule.value}`;
          }
        }
        break;

      case 'max':
        if (value !== null && value !== undefined) {
          const numValue = typeof value === 'string' ? parseFloat(value) : value;
          isValid = !isNaN(numValue) && numValue <= (rule.value || 0);
          if (!isValid && !errorMessage) {
            errorMessage = `Value must be no more than ${rule.value}`;
          }
        }
        break;

      case 'pattern':
        if (value && typeof value === 'string') {
          const regex = new RegExp(rule.value);
          isValid = regex.test(value);
          if (!isValid && !errorMessage) {
            errorMessage = 'Invalid format';
          }
        }
        break;

      case 'custom':
        if (rule.validator) {
          isValid = rule.validator(value);
          if (!isValid && !errorMessage) {
            errorMessage = 'Invalid value';
          }
        }
        break;
    }

    if (!isValid) {
      return errorMessage || 'Invalid value';
    }
  }

  return null;
}

/**
 * Validate an entire form object against field definitions
 */
export function validateEntityForm<T extends Record<string, any>>(
  data: Partial<T>,
  fields: EntityFormField[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = data[field.key as keyof T];
    
    // Build validation rules
    const rules: ValidationRule[] = [];
    
    if (field.required) {
      rules.push({ type: 'required' });
    }
    
    // Add type-specific validation
    if (field.type === 'email') {
      rules.push({ type: 'email' });
    } else if (field.type === 'phone') {
      rules.push({ type: 'phone' });
    }
    
    // Add custom validation rules from field
    if (field.validation) {
      rules.push(...field.validation);
    }

    // Validate the field
    const error = validateField(value, rules);
    if (error) {
      errors[field.key] = error;
    }
  }

  return errors;
}

/**
 * Common validation rules for reuse
 */
export const commonValidationRules = {
  required: (): ValidationRule => ({ type: 'required' }),
  
  email: (): ValidationRule => ({ type: 'email' }),
  
  phone: (): ValidationRule => ({ type: 'phone' }),
  
  minLength: (min: number, message?: string): ValidationRule => ({
    type: 'minLength',
    value: min,
    message
  }),
  
  maxLength: (max: number, message?: string): ValidationRule => ({
    type: 'maxLength',
    value: max,
    message
  }),
  
  min: (min: number, message?: string): ValidationRule => ({
    type: 'min',
    value: min,
    message
  }),
  
  max: (max: number, message?: string): ValidationRule => ({
    type: 'max',
    value: max,
    message
  }),
  
  pattern: (pattern: string | RegExp, message?: string): ValidationRule => ({
    type: 'pattern',
    value: pattern,
    message
  }),
  
  custom: (validator: (value: any) => boolean, message: string): ValidationRule => ({
    type: 'custom',
    validator,
    message
  }),

  // Business-specific validations
  leadName: (): ValidationRule[] => [
    commonValidationRules.required(),
    commonValidationRules.minLength(2, 'Lead name must be at least 2 characters'),
    commonValidationRules.maxLength(100, 'Lead name must be less than 100 characters')
  ],

  projectName: (): ValidationRule[] => [
    commonValidationRules.required(),
    commonValidationRules.minLength(3, 'Project name must be at least 3 characters'),
    commonValidationRules.maxLength(150, 'Project name must be less than 150 characters')
  ],

  sessionName: (): ValidationRule[] => [
    commonValidationRules.maxLength(100, 'Session name must be less than 100 characters')
  ],

  price: (): ValidationRule[] => [
    commonValidationRules.min(0, 'Price cannot be negative')
  ],

  futureDate: (): ValidationRule => 
    commonValidationRules.custom(
      (value) => {
        if (!value) return true;
        const date = new Date(value);
        return date > new Date();
      },
      VALIDATION_MESSAGES.FUTURE_DATE
    ),

  pastDate: (): ValidationRule =>
    commonValidationRules.custom(
      (value) => {
        if (!value) return true;
        const date = new Date(value);
        return date < new Date();
      },
      VALIDATION_MESSAGES.PAST_DATE
    ),

  businessHours: (): ValidationRule =>
    commonValidationRules.custom(
      (value) => {
        if (!value) return true;
        const [hours, minutes] = value.split(':').map(Number);
        const time = hours * 60 + minutes;
        return time >= 8 * 60 && time <= 20 * 60; // 8 AM to 8 PM
      },
      'Session must be scheduled during business hours (8 AM - 8 PM)'
    )
};

/**
 * Form field generators for common entities
 */
export const entityFormFields = {
  lead: {
    name: (): EntityFormField => ({
      key: 'name',
      type: 'text',
      label: 'Lead Name',
      placeholder: 'Enter lead name',
      required: true,
      validation: commonValidationRules.leadName()
    }),
    
    email: (): EntityFormField => ({
      key: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'Enter email address',
      validation: [commonValidationRules.email()]
    }),
    
    phone: (): EntityFormField => ({
      key: 'phone',
      type: 'phone',
      label: 'Phone',
      placeholder: 'Enter phone number',
      validation: [commonValidationRules.phone()]
    }),
    
    notes: (): EntityFormField => ({
      key: 'notes',
      type: 'textarea',
      label: 'Notes',
      placeholder: 'Add notes about this lead',
      rows: 3,
      validation: [commonValidationRules.maxLength(1000, 'Notes must be less than 1000 characters')]
    })
  },

  project: {
    name: (): EntityFormField => ({
      key: 'name',
      type: 'text',
      label: 'Project Name',
      placeholder: 'Enter project name',
      required: true,
      validation: commonValidationRules.projectName()
    }),
    
    description: (): EntityFormField => ({
      key: 'description',
      type: 'textarea',
      label: 'Description',
      placeholder: 'Describe the project',
      rows: 4,
      validation: [commonValidationRules.maxLength(500, 'Description must be less than 500 characters')]
    }),
    
    basePrice: (): EntityFormField => ({
      key: 'base_price',
      type: 'number',
      label: 'Base Price',
      placeholder: '0.00',
      min: 0,
      step: 0.01,
      validation: commonValidationRules.price(),
      helpText: 'Base price for this project'
    })
  },

  session: {
    sessionName: (): EntityFormField => ({
      key: 'session_name',
      type: 'text',
      label: 'Session Name',
      placeholder: 'Enter session name (optional)',
      validation: commonValidationRules.sessionName()
    }),
    
    sessionDate: (): EntityFormField => ({
      key: 'session_date',
      type: 'date',
      label: 'Session Date',
      required: true,
      validation: [commonValidationRules.required(), commonValidationRules.futureDate()]
    }),
    
    sessionTime: (): EntityFormField => ({
      key: 'session_time',
      type: 'time',
      label: 'Session Time',
      required: true,
      validation: [commonValidationRules.required(), commonValidationRules.businessHours()]
    }),
    
    location: (): EntityFormField => ({
      key: 'location',
      type: 'text',
      label: 'Location',
      placeholder: 'Enter session location',
      validation: [commonValidationRules.maxLength(200, 'Location must be less than 200 characters')]
    }),
    
    notes: (): EntityFormField => ({
      key: 'notes',
      type: 'textarea',
      label: 'Session Notes',
      placeholder: 'Add notes about this session',
      rows: 3,
      validation: [commonValidationRules.maxLength(1000, 'Notes must be less than 1000 characters')]
    })
  }
};