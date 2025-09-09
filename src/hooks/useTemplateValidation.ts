import { useMemo } from 'react';
import { Template, TemplateBuilderData } from '@/types/template';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function useTemplateValidation(template: Template | TemplateBuilderData | null) {
  return useMemo((): ValidationResult => {
    if (!template) {
      return {
        isValid: false,
        errors: ['Template is required'],
        warnings: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!template.master_content || template.master_content.trim() === '') {
      warnings.push('Template content is empty');
    }

    // Name validation
    const normalizedName = template.name?.toLowerCase().trim() || '';
    if (normalizedName === 'untitled template' || 
        normalizedName.includes('untitled') || 
        normalizedName === 'new template') {
      warnings.push('Consider giving your template a more descriptive name');
    }

    // Email channel validation for published templates
    if (template.is_active) {
      if (!template.channels?.email?.subject && !template.master_subject) {
        warnings.push('Published email templates should have a subject line');
      }

      if (!template.channels?.email?.content && !template.master_content) {
        errors.push('Published templates must have content');
      }
    }

    // Placeholder validation
    if (template.placeholders && template.placeholders.length > 0) {
      const contentToCheck = [
        template.master_content || '',
        template.master_subject || '',
        template.channels?.email?.content || '',
        template.channels?.sms?.content || '',
        template.channels?.whatsapp?.content || ''
      ].join(' ');

      template.placeholders.forEach(placeholder => {
        if (!contentToCheck.includes(`{${placeholder}}`)) {
          warnings.push(`Placeholder "{${placeholder}}" is defined but not used in content`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, [template]);
}