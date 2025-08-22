import { z } from 'zod';
import { LeadFieldDefinition, LeadFieldType } from '@/types/leadFields';

/**
 * Creates a dynamic validation schema based on field definitions
 */
export function createDynamicLeadSchema(fieldDefinitions: LeadFieldDefinition[]) {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  fieldDefinitions.forEach(field => {
    let fieldSchema = createFieldSchema(field.field_type, field.validation_rules);

    // Apply required validation
    if (field.is_required) {
      fieldSchema = fieldSchema.refine(
        (val) => val !== null && val !== undefined && val !== '', 
        { message: `${field.label} is required` }
      );
    } else {
      fieldSchema = fieldSchema.optional().nullable();
    }

    schemaFields[field.field_key] = fieldSchema;
  });

  return z.object(schemaFields);
}

/**
 * Creates a validation schema for a specific field type
 */
function createFieldSchema(fieldType: LeadFieldType, validationRules?: Record<string, any>): z.ZodTypeAny {
  switch (fieldType) {
    case 'text':
      let textSchema = z.string().max(validationRules?.maxLength || 255, `Text is too long`);
      if (validationRules?.minLength) {
        textSchema = textSchema.min(validationRules.minLength, `Text must be at least ${validationRules.minLength} characters`);
      }
      return textSchema;

    case 'textarea':
      let textareaSchema = z.string().max(validationRules?.maxLength || 1000, `Text is too long`);
      if (validationRules?.minLength) {
        textareaSchema = textareaSchema.min(validationRules.minLength, `Text must be at least ${validationRules.minLength} characters`);
      }
      return textareaSchema;

    case 'email':
      return z.string().email('Please enter a valid email address').max(254, 'Email address is too long');

    case 'phone':
      return z.string().regex(
        /^[\+]?[1-9][\d]{0,15}$/,
        'Please enter a valid phone number'
      ).max(20, 'Phone number is too long');

    case 'date':
      return z.string().regex(
        /^\d{4}-\d{2}-\d{2}$/,
        'Please enter a valid date (YYYY-MM-DD)'
      );

    case 'select':
      return z.string().min(1, 'Please select an option');

    case 'checkbox':
      return z.boolean().or(z.string().transform((val) => val === 'true' || val === '1'));

    case 'number':
      let numberSchema = z.string().refine(
        (val) => !isNaN(Number(val)) && val !== '',
        'Please enter a valid number'
      );
      
      if (validationRules?.min !== undefined) {
        numberSchema = numberSchema.refine(
          (val) => Number(val) >= validationRules.min,
          `Number must be at least ${validationRules.min}`
        );
      }
      
      if (validationRules?.max !== undefined) {
        numberSchema = numberSchema.refine(
          (val) => Number(val) <= validationRules.max,
          `Number must be at most ${validationRules.max}`
        );
      }
      
      return numberSchema;

    default:
      return z.string().max(255);
  }
}

/**
 * Sanitizes field values for storage
 */
export function sanitizeFieldValue(value: any, fieldType: LeadFieldType): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (fieldType) {
    case 'checkbox':
      return Boolean(value).toString();
    
    case 'number':
      const num = Number(value);
      return isNaN(num) ? null : num.toString();
    
    case 'date':
      // Ensure proper date format
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    
    default:
      return String(value).trim();
  }
}

/**
 * Parses stored field values for display/editing
 */
export function parseFieldValue(value: string | null, fieldType: LeadFieldType): any {
  if (value === null || value === undefined) {
    return fieldType === 'checkbox' ? false : '';
  }

  switch (fieldType) {
    case 'checkbox':
      return value === 'true' || value === '1';
    
    case 'number':
      const num = Number(value);
      return isNaN(num) ? '' : num;
    
    default:
      return value;
  }
}

/**
 * Validates a single field value
 */
export function validateFieldValue(
  value: any, 
  fieldDefinition: LeadFieldDefinition
): { isValid: boolean; error?: string } {
  try {
    const schema = createFieldSchema(fieldDefinition.field_type, fieldDefinition.validation_rules);
    
    if (fieldDefinition.is_required) {
      schema.parse(value);
    } else {
      schema.optional().nullable().parse(value);
    }
    
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        isValid: false, 
        error: error.issues[0]?.message || 'Invalid value' 
      };
    }
    return { 
      isValid: false, 
      error: 'Validation failed' 
    };
  }
}