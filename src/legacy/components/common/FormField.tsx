import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EntityFormField } from './EntityForm';

type PrimitiveFieldValue = string | number | boolean | null | undefined;

interface FormFieldProps {
  field: EntityFormField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export function FormField({
  field,
  value,
  onChange,
  error,
  disabled = false
}: FormFieldProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = field.type === 'number' ? parseFloat(e.target.value) : e.target.value;
    onChange(newValue);
  };

  const handleSelectChange = (newValue: string) => {
    onChange(newValue);
  };

  const handleCheckboxChange = (checked: boolean) => {
    onChange(checked);
  };

  const renderInput = () => {
    const normalizedValue = (): PrimitiveFieldValue => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
      }
      if (value == null) {
        return '';
      }
      return String(value);
    };

    const baseProps = {
      id: field.key,
      value: normalizedValue(),
      disabled,
      className: error ? 'border-destructive' : '',
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            {...baseProps}
            placeholder={field.placeholder}
            rows={field.rows || 3}
            onChange={handleInputChange}
          />
        );

      case 'select':
        return (
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={handleSelectChange}
            disabled={disabled}
          >
            <SelectTrigger className={error ? 'border-destructive' : ''}>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={value === true}
              onCheckedChange={handleCheckboxChange}
              disabled={disabled}
            />
            <Label
              htmlFor={field.key}
              className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                error ? 'text-destructive' : ''
              }`}
            >
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
          </div>
        );

      case 'number':
        return (
          <Input
            {...baseProps}
            type="number"
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={handleInputChange}
          />
        );

      case 'date':
        return (
          <Input
            {...baseProps}
            type="date"
            min={field.min}
            max={field.max}
            onChange={handleInputChange}
          />
        );

      case 'time':
        return (
          <Input
            {...baseProps}
            type="time"
            step={field.step}
            onChange={handleInputChange}
          />
        );

      case 'email':
        return (
          <Input
            {...baseProps}
            type="email"
            placeholder={field.placeholder}
            onChange={handleInputChange}
          />
        );

      case 'phone':
        return (
          <Input
            {...baseProps}
            type="tel"
            placeholder={field.placeholder}
            onChange={handleInputChange}
          />
        );

      default:
        return (
          <Input
            {...baseProps}
            type="text"
            placeholder={field.placeholder}
            onChange={handleInputChange}
          />
        );
    }
  };

  if (field.type === 'checkbox') {
    return (
      <div className="space-y-2">
        {renderInput()}
        {field.helpText && (
          <p className="text-xs text-muted-foreground">{field.helpText}</p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label
          htmlFor={field.key}
          className={`text-sm font-medium ${error ? 'text-destructive' : ''}`}
        >
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        
        {field.helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">{field.helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {renderInput()}
      
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
