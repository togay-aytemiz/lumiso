import { z } from 'zod';

import type { LeadFieldDefinition, LeadFieldType } from '@/types/leadFields';

type FieldValidationRules = Record<string, unknown> | null | undefined;
type FieldSchema = z.ZodTypeAny;

const getNumericRule = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export function createDynamicLeadSchema(fieldDefinitions: LeadFieldDefinition[]) {
  const schemaFields: Record<string, FieldSchema> = {};

  fieldDefinitions.forEach(field => {
    let fieldSchema = createFieldSchema(field.field_type, field.validation_rules);

    if (field.is_required) {
      fieldSchema = fieldSchema.refine(
        (val) => val !== null && val !== undefined && val !== '',
        { message: `${field.label} is required` }
      );
    } else {
      fieldSchema = fieldSchema.optional().nullable();
    }

    schemaFields[`field_${field.field_key}`] = fieldSchema;
  });

  return z.object(schemaFields);
}

function createFieldSchema(fieldType: LeadFieldType, validationRules?: FieldValidationRules): FieldSchema {
  const rules = (validationRules ?? {}) as Record<string, unknown>;

  switch (fieldType) {
    case 'text': {
      const textRules = rules as Partial<{ maxLength: number; minLength: number }>;
      let textSchema = z.string().max(getNumericRule(textRules.maxLength) ?? 255, 'Text is too long');
      if (typeof textRules.minLength === 'number') {
        textSchema = textSchema.min(textRules.minLength, `Text must be at least ${textRules.minLength} characters`);
      }
      return textSchema;
    }

    case 'textarea': {
      const textAreaRules = rules as Partial<{ maxLength: number; minLength: number }>;
      let textareaSchema = z.string().max(getNumericRule(textAreaRules.maxLength) ?? 1000, 'Text is too long');
      if (typeof textAreaRules.minLength === 'number') {
        textareaSchema = textareaSchema.min(
          textAreaRules.minLength,
          `Text must be at least ${textAreaRules.minLength} characters`
        );
      }
      return textareaSchema;
    }

    case 'email':
      return z
        .string()
        .refine((val) => val === '' || z.string().email().safeParse(val).success, 'Please enter a valid email address')
        .max(254, 'Email address is too long');

    case 'phone':
      return z
        .string()
        .refine((val) => val === '' || /^\+?[\d\s-()]+$/.test(val), 'Please enter a valid phone number')
        .max(20, 'Phone number is too long');

    case 'date':
      return z
        .string()
        .refine((val) => val === '' || /^\d{4}-\d{2}-\d{2}$/.test(val), 'Please enter a valid date (YYYY-MM-DD)');

    case 'select':
      return z.string();

    case 'checkbox':
      return z.union([z.boolean(), z.string().transform((val) => val === 'true' || val === '1')]);

    case 'number': {
      const numberRules = rules as Partial<{ min: number; max: number }>;
      let numberSchema = z
        .string()
        .refine((val) => val === '' || (!Number.isNaN(Number(val)) && val.trim() !== ''), 'Please enter a valid number');

      if (typeof numberRules.min === 'number') {
        numberSchema = numberSchema.refine(
          (val) => val === '' || Number(val) >= numberRules.min!,
          `Number must be at least ${numberRules.min}`
        );
      }

      if (typeof numberRules.max === 'number') {
        numberSchema = numberSchema.refine(
          (val) => val === '' || Number(val) <= numberRules.max!,
          `Number must be at most ${numberRules.max}`
        );
      }

      return numberSchema;
    }

    default:
      return z.string().max(255);
  }
}

export function sanitizeFieldValue(value: unknown, fieldType: LeadFieldType): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (fieldType) {
    case 'checkbox':
      return Boolean(value).toString();

    case 'number': {
      const numericValue = typeof value === 'number' ? value : Number(value);
      return Number.isNaN(numericValue) ? null : numericValue.toString();
    }

    case 'date': {
      const date = new Date(value as string);
      return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }

    default:
      return String(value).trim();
  }
}

export function parseFieldValue(value: string | null, fieldType: LeadFieldType): string | number | boolean {
  if (value === null || value === undefined) {
    return fieldType === 'checkbox' ? false : '';
  }

  switch (fieldType) {
    case 'checkbox':
      return value === 'true' || value === '1';

    case 'number': {
      const numericValue = Number(value);
      return Number.isNaN(numericValue) ? '' : numericValue;
    }

    default:
      return value;
  }
}

export function validateFieldValue(
  value: unknown,
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
        error: error.issues[0]?.message || 'Invalid value',
      };
    }
    return {
      isValid: false,
      error: 'Validation failed',
    };
  }
}
