import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Save, X } from 'lucide-react';
import { FormField } from './FormField';
import { validateEntityForm, ValidationRule } from '@/utils/validationUtils';

export interface EntityFormField {
  key: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'date' | 'time' | 'number' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required?: boolean;
  validation?: ValidationRule[];
  options?: Array<{ value: string; label: string }>;
  rows?: number; // for textarea
  min?: number; // for number/date
  max?: number; // for number/date
  step?: number; // for number
  disabled?: boolean;
  helpText?: string;
}

export interface EntityFormProps<T> {
  title?: string;
  fields: EntityFormField[];
  initialData?: Partial<T>;
  onSubmit: (data: T) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  error?: string | null;
  className?: string;
  showCard?: boolean;
  validateOnChange?: boolean;
}

export function EntityForm<T extends Record<string, unknown>>({
  title,
  fields,
  initialData = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  loading = false,
  error = null,
  className,
  showCard = true,
  validateOnChange = false
}: EntityFormProps<T>) {
  const [formData, setFormData] = useState<Partial<T>>(initialData);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleFieldChange = useCallback((fieldKey: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value as T[keyof T] }));
    setTouched(prev => ({ ...prev, [fieldKey]: true }));

    // Clear field error when user starts typing
    if (fieldErrors[fieldKey]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldKey];
        return newErrors;
      });
    }

    // Validate on change if enabled
    if (validateOnChange) {
      const field = fields.find(f => f.key === fieldKey);
      if (field && field.validation) {
        const fieldError = validateEntityForm({ [fieldKey]: value }, [field]);
        if (fieldError[fieldKey]) {
          setFieldErrors(prev => ({ ...prev, [fieldKey]: fieldError[fieldKey] }));
        }
      }
    }
  }, [fieldErrors, fields, validateOnChange]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const errors = validateEntityForm(formData, fields);
    setFieldErrors(errors);

    // Mark all fields as touched to show errors
    const touchedFields = fields.reduce((acc, field) => {
      acc[field.key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouched(touchedFields);

    // Don't submit if there are validation errors
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await onSubmit(formData as T);
    } catch (error) {
      // Error is handled by the parent component
      console.error('Form submission error:', error);
    }
  }, [formData, fields, onSubmit]);

  const handleCancel = useCallback(() => {
    setFormData(initialData);
    setFieldErrors({});
    setTouched({});
    onCancel?.();
  }, [initialData, onCancel]);

  const isValid = Object.keys(fieldErrors).length === 0;
  const hasRequiredFields = fields.some(field => field.required);
  const canSubmit = hasRequiredFields ? isValid && Object.keys(touched).length > 0 : isValid;

  const content = (
    <form onSubmit={handleSubmit} className={className}>
      {title && !showCard && <h2 className="text-xl font-semibold mb-6">{title}</h2>}
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {fields.map((field) => (
          <FormField
            key={field.key}
            field={field}
            value={formData[field.key]}
            onChange={(value) => handleFieldChange(field.key, value)}
            error={touched[field.key] ? fieldErrors[field.key] : undefined}
            disabled={loading || field.disabled}
          />
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-6">
        <Button
          type="submit"
          disabled={loading || !canSubmit}
          className="flex-1 sm:flex-none"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : submitLabel}
        </Button>
        
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            <X className="h-4 w-4 mr-2" />
            {cancelLabel}
          </Button>
        )}
      </div>
    </form>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
