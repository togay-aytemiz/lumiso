// Types for custom lead field management system

export type LeadFieldType = 
  | 'text' 
  | 'textarea' 
  | 'email' 
  | 'phone' 
  | 'date' 
  | 'select' 
  | 'checkbox' 
  | 'number';

export interface LeadFieldDefinition {
  id: string;
  organization_id: string;
  field_key: string;
  label: string;
  field_type: LeadFieldType;
  is_system: boolean;
  is_required: boolean;
  is_visible_in_form: boolean;
  is_visible_in_table: boolean;
  sort_order: number;
  options?: { options: string[] };
  validation_rules?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LeadFieldValue {
  id: string;
  lead_id: string;
  field_key: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadFieldDefinition {
  field_key: string;
  label: string;
  field_type: LeadFieldType;
  is_required?: boolean;
  is_visible_in_form?: boolean;
  is_visible_in_table?: boolean;
  sort_order?: number;
  options?: { options: string[] };
  validation_rules?: Record<string, any>;
}

export interface UpdateLeadFieldDefinition {
  label?: string;
  is_required?: boolean;
  is_visible_in_form?: boolean;
  is_visible_in_table?: boolean;
  sort_order?: number;
  options?: { options: string[] };
  validation_rules?: Record<string, any>;
}

export interface LeadWithFieldValues {
  id: string;
  organization_id: string;
  user_id: string;
  status_id: string | null;
  assignees: string[];
  due_date: string | null;
  created_at: string;
  updated_at: string;
  field_values: Record<string, string | null>;
}

// System field keys that cannot be deleted
export const SYSTEM_FIELD_KEYS = ['name', 'email', 'phone', 'notes'] as const;

// Default field type configurations
export const FIELD_TYPE_CONFIG: Record<LeadFieldType, {
  label: string;
  supportsOptions: boolean;
  supportsValidation: boolean;
  defaultValidation?: Record<string, any>;
}> = {
  text: {
    label: 'Single Line Text',
    supportsOptions: false,
    supportsValidation: true,
    defaultValidation: { maxLength: 255 }
  },
  textarea: {
    label: 'Multi-line Text',
    supportsOptions: false,
    supportsValidation: true,
    defaultValidation: { maxLength: 1000 }
  },
  email: {
    label: 'Email Address',
    supportsOptions: false,
    supportsValidation: true,
    defaultValidation: { format: 'email' }
  },
  phone: {
    label: 'Phone Number',
    supportsOptions: false,
    supportsValidation: true,
    defaultValidation: { format: 'phone' }
  },
  date: {
    label: 'Date',
    supportsOptions: false,
    supportsValidation: true
  },
  select: {
    label: 'Dropdown',
    supportsOptions: true,
    supportsValidation: false
  },
  checkbox: {
    label: 'Checkbox',
    supportsOptions: false,
    supportsValidation: false
  },
  number: {
    label: 'Number',
    supportsOptions: false,
    supportsValidation: true,
    defaultValidation: { type: 'number' }
  }
};