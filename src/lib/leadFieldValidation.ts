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

    // Use prefixed field name to match form data structure
    schemaFields[`field_${field.field_key}`] = fieldSchema;
  });

  return z.object(schemaFields);
}

/**
 * Creates a validation schema for a specific field type
 */
function createFieldSchema(fieldType: LeadFieldType, validationRules?: Record<string, any> | null): z.ZodTypeAny {
  // Handle null validation rules
  const rules = validationRules || {};
  
  switch (fieldType) {
    case 'text':
      let textSchema = z.string().max(rules?.maxLength || 255, `Text is too long`);
      if (rules?.minLength) {
        textSchema = textSchema.min(rules.minLength, `Text must be at least ${rules.minLength} characters`);
      }
      return textSchema;

    case 'textarea':
      let textareaSchema = z.string().max(rules?.maxLength || 1000, `Text is too long`);
      if (rules?.minLength) {
        textareaSchema = textareaSchema.min(rules.minLength, `Text must be at least ${rules.minLength} characters`);
      }
      return textareaSchema;

    case 'email':
      return z.string().refine(
        (val) => val === '' || z.string().email().safeParse(val).success,
        'Please enter a valid email address'
      ).max(254, 'Email address is too long');

    case 'phone':
      return z.string().refine(
        (val) => val === '' || /^[\+]?[\d\s\-\(\)]+$/.test(val),
        'Please enter a valid phone number'
      ).max(20, 'Phone number is too long');

    case 'date':
      return z.string().refine(
        (val) => val === '' || /^\d{4}-\d{2}-\d{2}$/.test(val),
        'Please enter a valid date (YYYY-MM-DD)'
      );

    case 'select':
      return z.string();

    case 'checkbox':
      return z.boolean().or(z.string().transform((val) => val === 'true' || val === '1'));

    case 'number':
      let numberSchema = z.string().refine(
        (val) => val === '' || (!isNaN(Number(val)) && val.trim() !== ''),
        'Please enter a valid number'
      );
      
      if (rules?.min !== undefined) {
        numberSchema = numberSchema.refine(
          (val) => val === '' || Number(val) >= rules.min,
          `Number must be at least ${rules.min}`
        );
      }
      
      if (rules?.max !== undefined) {
        numberSchema = numberSchema.refine(
          (val) => val === '' || Number(val) <= rules.max,
          `Number must be at most ${rules.max}`
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