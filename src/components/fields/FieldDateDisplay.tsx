import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { getDateFnsLocale } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface FieldDateDisplayProps {
  value: string;
  formatString?: string;
}

export function FieldDateDisplay({ 
  value, 
  formatString = "PPP" 
}: FieldDateDisplayProps) {
  const { t } = useTranslation("common");
  if (!value) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  const formatDate = (dateValue: string) => {
    try {
      return format(new Date(dateValue), formatString, { locale: getDateFnsLocale() });
    } catch {
      return dateValue;
    }
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      <Calendar className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span>{formatDate(value)}</span>
    </div>
  );
}
