import { useTranslation } from "react-i18next";

interface FieldNumberDisplayProps {
  value: string;
  formatOptions?: Intl.NumberFormatOptions;
  locale?: string;
}

export function FieldNumberDisplay({ 
  value, 
  formatOptions,
  locale = "en-US"
}: FieldNumberDisplayProps) {
  const { t } = useTranslation("common");
  if (!value) {
    return <span className="text-muted-foreground italic">{t("notProvided")}</span>;
  }

  const formatNumber = (numValue: string) => {
    const parsedNumber = parseFloat(numValue);
    
    if (isNaN(parsedNumber)) {
      return numValue; // Return original if not a valid number
    }

    if (formatOptions) {
      return new Intl.NumberFormat(locale, formatOptions).format(parsedNumber);
    }

    return parsedNumber.toString();
  };

  return (
    <span className="text-sm">
      {formatNumber(value)}
    </span>
  );
}
