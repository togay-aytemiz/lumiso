import { Badge } from '@/components/ui/badge';
import { useTranslation } from "react-i18next";

interface FieldMultiSelectDisplayProps {
  value: string;
}

export function FieldMultiSelectDisplay({ value }: FieldMultiSelectDisplayProps) {
  const { t } = useTranslation("common");
  const values = value.split(',').map(v => v.trim()).filter(Boolean);
  
  if (values.length === 0) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {values.map((val, index) => (
        <Badge key={index} variant="secondary" className="text-xs">
          {val}
        </Badge>
      ))}
    </div>
  );
}
