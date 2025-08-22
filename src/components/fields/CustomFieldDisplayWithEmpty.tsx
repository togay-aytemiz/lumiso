import { CustomFieldDisplay } from './CustomFieldDisplay';
import { LeadFieldDefinition } from '@/types/leadFields';

interface CustomFieldDisplayWithEmptyProps {
  fieldDefinition: LeadFieldDefinition;
  value: string | null;
  showCopyButtons?: boolean;
  allowTruncation?: boolean;
  maxLines?: number;
}

export function CustomFieldDisplayWithEmpty({
  fieldDefinition,
  value,
  showCopyButtons = false,
  allowTruncation = true,
  maxLines = 2
}: CustomFieldDisplayWithEmptyProps) {
  if (!value) {
    return <span className="text-muted-foreground"> - </span>;
  }

  return (
    <CustomFieldDisplay
      fieldDefinition={fieldDefinition}
      value={value}
      showCopyButtons={showCopyButtons}
      allowTruncation={allowTruncation}
      maxLines={maxLines}
    />
  );
}