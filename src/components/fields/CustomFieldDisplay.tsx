import { LeadFieldDefinition } from "@/types/leadFields";
import { FieldTextDisplay } from "./FieldTextDisplay";
import { FieldTextareaDisplay } from "./FieldTextareaDisplay";
import { FieldTextTableDisplay } from "./FieldTextTableDisplay";
import { FieldTextareaTableDisplay } from "./FieldTextareaTableDisplay";
import { FieldEmailDisplay } from "./FieldEmailDisplay";
import { FieldPhoneDisplay } from "./FieldPhoneDisplay";
import { FieldDateDisplay } from "./FieldDateDisplay";
import { FieldSelectDisplay } from "./FieldSelectDisplay";
import { FieldMultiSelectDisplay } from "./FieldMultiSelectDisplay";
import { FieldCheckboxDisplay } from "./FieldCheckboxDisplay";
import { FieldNumberDisplay } from "./FieldNumberDisplay";
import { useTranslation } from "react-i18next";

interface CustomFieldDisplayProps {
  fieldDefinition: LeadFieldDefinition;
  value: string | null;
  showCopyButtons?: boolean;
  allowTruncation?: boolean;
  maxLines?: number;
  tableContext?: boolean;
}

export function CustomFieldDisplay({ 
  fieldDefinition, 
  value, 
  showCopyButtons = true,
  allowTruncation = true,
  maxLines = 3,
  tableContext = false
}: CustomFieldDisplayProps) {
  const { t } = useTranslation("common");
  if (!value) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  switch (fieldDefinition.field_type) {
    case 'text':
      return tableContext ? (
        <FieldTextTableDisplay value={value} />
      ) : (
        <FieldTextDisplay 
          value={value} 
          allowTruncation={allowTruncation}
          maxLines={maxLines}
        />
      );
    
    case 'textarea':
      return tableContext ? (
        <FieldTextareaTableDisplay value={value} />
      ) : (
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
      if (fieldDefinition.allow_multiple) {
        return <FieldMultiSelectDisplay value={value} />;
      }
      return <FieldSelectDisplay value={value} />;
    
    case 'checkbox':
      return (
        <FieldCheckboxDisplay value={value} />
      );
    
    case 'number':
      return (
        <FieldNumberDisplay value={value} />
      );
    
    default:
      return tableContext ? (
        <FieldTextTableDisplay value={value} />
      ) : (
        <FieldTextDisplay 
          value={value} 
          allowTruncation={allowTruncation}
          maxLines={maxLines}
        />
      );
  }
}
