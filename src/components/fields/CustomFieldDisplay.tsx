import { LeadFieldDefinition } from "@/types/leadFields";
import { FieldTextDisplay } from "./FieldTextDisplay";
import { FieldTextareaDisplay } from "./FieldTextareaDisplay";
import { FieldEmailDisplay } from "./FieldEmailDisplay";
import { FieldPhoneDisplay } from "./FieldPhoneDisplay";
import { FieldDateDisplay } from "./FieldDateDisplay";
import { FieldSelectDisplay } from "./FieldSelectDisplay";
import { FieldCheckboxDisplay } from "./FieldCheckboxDisplay";
import { FieldNumberDisplay } from "./FieldNumberDisplay";

interface CustomFieldDisplayProps {
  fieldDefinition: LeadFieldDefinition;
  value: string | null;
  showCopyButtons?: boolean;
  allowTruncation?: boolean;
  maxLines?: number;
}

export function CustomFieldDisplay({ 
  fieldDefinition, 
  value, 
  showCopyButtons = true,
  allowTruncation = true,
  maxLines = 3
}: CustomFieldDisplayProps) {
  if (!value) {
    return <span className="text-muted-foreground italic">Not provided</span>;
  }

  switch (fieldDefinition.field_type) {
    case 'text':
      return (
        <FieldTextDisplay 
          value={value} 
          allowTruncation={allowTruncation}
          maxLines={maxLines}
        />
      );
    
    case 'textarea':
      return (
        <FieldTextareaDisplay 
          value={value} 
          maxLines={maxLines}
        />
      );
    
    case 'email':
      return (
        <FieldEmailDisplay 
          value={value} 
          showCopyButton={showCopyButtons}
        />
      );
    
    case 'phone':
      return (
        <FieldPhoneDisplay 
          value={value} 
          showCopyButton={showCopyButtons}
        />
      );
    
    case 'date':
      return (
        <FieldDateDisplay value={value} />
      );
    
    case 'select':
      return (
        <FieldSelectDisplay value={value} />
      );
    
    case 'checkbox':
      return (
        <FieldCheckboxDisplay value={value} />
      );
    
    case 'number':
      return (
        <FieldNumberDisplay value={value} />
      );
    
    default:
      return (
        <FieldTextDisplay 
          value={value} 
          allowTruncation={allowTruncation}
          maxLines={maxLines}
        />
      );
  }
}