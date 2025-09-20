import { Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { LeadFieldDefinition } from "@/types/leadFields";

interface DynamicLeadFormFieldsProps {
  fieldDefinitions: LeadFieldDefinition[];
  control: Control<any>;
  visibleOnly?: boolean;
}

export function DynamicLeadFormFields({ 
  fieldDefinitions, 
  control, 
  visibleOnly = true 
}: DynamicLeadFormFieldsProps) {
  const { t } = useTranslation('forms');
  const fieldsToRender = visibleOnly 
    ? fieldDefinitions.filter(field => field.is_visible_in_form)
    : fieldDefinitions;

  const renderField = (field: LeadFieldDefinition) => {
    const fieldName = `field_${field.field_key}`;
    
    return (
      <FormField
        key={field.id}
        control={control}
        name={fieldName}
        rules={{
          required: field.is_required ? `${field.label} ${t('dynamicFields.required')}` : false,
        }}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel>
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </FormLabel>
            <FormControl>
              {renderFieldInput(field, formField)}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  const renderFieldInput = (fieldDef: LeadFieldDefinition, formField: any) => {
    switch (fieldDef.field_type) {
      case 'text':
        return (
          <Input
            placeholder={t('dynamicFields.enterField', { field: fieldDef.label.toLowerCase() })}
            {...formField}
          />
        );

      case 'textarea':
        return (
          <Textarea
            placeholder={t('dynamicFields.enterField', { field: fieldDef.label.toLowerCase() })}
            rows={3}
            {...formField}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            placeholder={t('dynamicFields.enterField', { field: fieldDef.label.toLowerCase() })}
            {...formField}
          />
        );

      case 'phone':
        return (
          <Input
            type="tel"
            placeholder={t('dynamicFields.enterField', { field: fieldDef.label.toLowerCase() })}
            {...formField}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            placeholder={t('dynamicFields.enterField', { field: fieldDef.label.toLowerCase() })}
            {...formField}
            onChange={(e) => formField.onChange(e.target.value ? Number(e.target.value) : '')}
          />
        );

      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formField.value && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formField.value ? (
                  format(new Date(formField.value), "PPP")
                ) : (
                  <span>{t('dynamicFields.pickDate')}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formField.value ? new Date(formField.value) : undefined}
                onSelect={(date) => formField.onChange(date?.toISOString().split('T')[0])}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        );

      case 'select':
        const options = fieldDef.options?.options || [];
        return (
          <Select onValueChange={formField.onChange} value={formField.value}>
            <SelectTrigger>
              <SelectValue placeholder={t('dynamicFields.selectField', { field: fieldDef.label.toLowerCase() })} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={index} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={formField.value}
              onCheckedChange={formField.onChange}
            />
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              {fieldDef.label}
            </label>
          </div>
        );

      default:
        return (
          <Input
            placeholder={t('dynamicFields.enterField', { field: fieldDef.label.toLowerCase() })}
            {...formField}
          />
        );
    }
  };

  if (fieldsToRender.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground text-sm">{t('dynamicFields.noFieldsAvailable')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fieldsToRender
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(renderField)}
    </div>
  );
}