import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FieldCheckboxDisplayProps {
  value: string;
}

export function FieldCheckboxDisplay({ value }: FieldCheckboxDisplayProps) {
  const { t } = useTranslation("common");
  if (!value) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  const isTrue = value === 'true' || value === '1' || value.toLowerCase() === 'yes';

  return (
    <Badge 
      variant={isTrue ? "default" : "secondary"} 
      className="text-xs flex items-center gap-1"
    >
      {isTrue ? (
        <>
          <Check className="h-3 w-3" />
          {t("yes")}
        </>
      ) : (
        <>
          <X className="h-3 w-3" />
          {t("no")}
        </>
      )}
    </Badge>
  );
}
