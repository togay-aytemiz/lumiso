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
  if (!value) {
    return <span className="text-muted-foreground italic">Not provided</span>;
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
    <span className="text-sm font-mono">
      {formatNumber(value)}
    </span>
  );
}